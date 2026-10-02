import { assertEquals, assertRejects } from "jsr:@std/assert";

import { ensurePaidSessionPaymentAuthorization } from "./session-payment-authorization-recovery.ts";

class StubPaymentsClient {
  readonly rpcCalls: Array<{ body: unknown; name: string }> = [];

  constructor(private readonly responses: unknown[]) {}

  async rpc<T>(name: string, body: unknown): Promise<T> {
    this.rpcCalls.push({ body, name });
    return this.responses.shift() as T;
  }
}

const input = {
  checkoutMode: "initial_hold",
  checkoutSessionId: "checkout-1",
  eventId: "event-1",
  eventTime: "2026-09-27T14:45:26.000Z",
  paymentIntentId: "payment-intent-1",
  sessionPaymentId: "payment-1",
};

const recoveryBody = {
  p_session_payment_id: "payment-1",
  p_stripe_checkout_session_id: "checkout-1",
  p_stripe_payment_intent_id: "payment-intent-1",
  p_stripe_event_created_at: "2026-09-27T14:45:26.000Z",
  p_stripe_event_id: "event-1",
};

Deno.test("skips provider authorization outside a supported Checkout mode", async () => {
  const client = new StubPaymentsClient([]);

  await ensurePaidSessionPaymentAuthorization(client, {
    ...input,
    checkoutMode: "scheduled",
  });

  assertEquals(client.rpcCalls, []);
});

Deno.test("revalidates an initial hold before confirming its paid event", async () => {
  const client = new StubPaymentsClient([
    { claimed: true, reason: "not_required" },
  ]);

  await ensurePaidSessionPaymentAuthorization(client, input);

  assertEquals(client.rpcCalls, [
    {
      body: recoveryBody,
      name: "recover_failed_session_payment_authorization_v10",
    },
  ]);
});

Deno.test("fails closed when a failed initial hold cannot recover its slot", async () => {
  const client = new StubPaymentsClient([
    { claimed: false, reason: "slot_conflict" },
  ]);

  await assertRejects(
    () => ensurePaidSessionPaymentAuthorization(client, input),
    Error,
    "session_payment_paid_authorization_not_claimed:initial_hold:slot_conflict",
  );
});

Deno.test("keeps the canonical authorization claim for a paid retry", async () => {
  const client = new StubPaymentsClient([
    { claimed: true, reason: "claimed" },
  ]);

  await ensurePaidSessionPaymentAuthorization(client, {
    ...input,
    checkoutMode: "payment_retry",
  });

  assertEquals(client.rpcCalls, [
    {
      body: {
        p_event_created_at: input.eventTime,
        p_request_id: input.eventId,
        p_session_payment_id: input.sessionPaymentId,
        p_stripe_checkout_session_id: input.checkoutSessionId,
        p_stripe_payment_intent_id: input.paymentIntentId,
      },
      name: "claim_session_payment_authorization_v1",
    },
  ]);
});

Deno.test("recovers a paid retry when the same Checkout first failed", async () => {
  const client = new StubPaymentsClient([
    { claimed: false, reason: "failed" },
    { claimed: true, reason: "recovered" },
  ]);

  await ensurePaidSessionPaymentAuthorization(client, {
    ...input,
    checkoutMode: "payment_retry",
  });

  assertEquals(client.rpcCalls.map((call) => call.name), [
    "claim_session_payment_authorization_v1",
    "recover_failed_session_payment_authorization_v10",
  ]);
  assertEquals(client.rpcCalls[1]?.body, recoveryBody);
});

Deno.test("fails closed when a failed paid retry cannot be recovered", async () => {
  const client = new StubPaymentsClient([
    { claimed: false, reason: "failed" },
    { claimed: false, reason: "patient_schedule_conflict" },
  ]);

  await assertRejects(
    () =>
      ensurePaidSessionPaymentAuthorization(client, {
        ...input,
        checkoutMode: "payment_retry",
      }),
    Error,
    "session_payment_paid_authorization_not_claimed:payment_retry:patient_schedule_conflict",
  );
});

Deno.test("rejects a paid Checkout without its persisted identifier", async () => {
  const client = new StubPaymentsClient([]);

  await assertRejects(
    () =>
      ensurePaidSessionPaymentAuthorization(client, {
        ...input,
        checkoutSessionId: null,
      }),
    Error,
    "session_payment_paid_checkout_missing",
  );
  assertEquals(client.rpcCalls, []);
});

Deno.test("preserves a fully discounted initial Checkout without PaymentIntent", async () => {
  const client = new StubPaymentsClient([]);

  await ensurePaidSessionPaymentAuthorization(client, {
    ...input,
    paymentIntentId: null,
  });
  assertEquals(client.rpcCalls, []);
});

Deno.test("rejects failed retry recovery without its PaymentIntent", async () => {
  const client = new StubPaymentsClient([
    { claimed: false, reason: "failed" },
  ]);

  await assertRejects(
    () =>
      ensurePaidSessionPaymentAuthorization(client, {
        ...input,
        checkoutMode: "payment_retry",
        paymentIntentId: null,
      }),
    Error,
    "session_payment_paid_intent_missing",
  );
  assertEquals(client.rpcCalls.length, 1);
});
