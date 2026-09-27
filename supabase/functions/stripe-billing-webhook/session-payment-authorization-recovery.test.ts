import { assertEquals, assertRejects } from "jsr:@std/assert";

import { ensurePaidPaymentRetryAuthorization } from "./session-payment-authorization-recovery.ts";

class StubPaymentsClient {
  readonly rpcCalls: Array<{ body: unknown; name: string }> = [];

  constructor(private readonly response: unknown) {}

  async rpc<T>(name: string, body: unknown): Promise<T> {
    this.rpcCalls.push({ body, name });
    return this.response as T;
  }
}

Deno.test("skips provider claim outside a paid payment retry", async () => {
  const client = new StubPaymentsClient({ claimed: false });

  await ensurePaidPaymentRetryAuthorization(client, {
    checkoutMode: "initial_hold",
    checkoutSessionId: "checkout-1",
    eventId: "event-1",
    eventTime: "2026-09-27T14:45:26.000Z",
    paymentIntentId: "payment-intent-1",
    sessionPaymentId: "payment-1",
  });

  assertEquals(client.rpcCalls, []);
});

Deno.test("reclaims the slot before reconciling a paid retry", async () => {
  const client = new StubPaymentsClient({
    claimed: true,
    reason: "claimed",
  });

  await ensurePaidPaymentRetryAuthorization(client, {
    checkoutMode: "payment_retry",
    checkoutSessionId: "checkout-1",
    eventId: "event-1",
    eventTime: "2026-09-27T14:45:26.000Z",
    paymentIntentId: "payment-intent-1",
    sessionPaymentId: "payment-1",
  });

  assertEquals(client.rpcCalls, [
    {
      body: {
        p_event_created_at: "2026-09-27T14:45:26.000Z",
        p_request_id: "event-1",
        p_session_payment_id: "payment-1",
        p_stripe_checkout_session_id: "checkout-1",
        p_stripe_payment_intent_id: "payment-intent-1",
      },
      name: "claim_session_payment_authorization_v1",
    },
  ]);
});

Deno.test("fails closed when a paid retry can no longer reclaim the slot", async () => {
  const client = new StubPaymentsClient({
    claimed: false,
    reason: "patient_schedule_conflict",
  });

  await assertRejects(
    () =>
      ensurePaidPaymentRetryAuthorization(client, {
        checkoutMode: "payment_retry",
        checkoutSessionId: "checkout-1",
        eventId: "event-1",
        eventTime: "2026-09-27T14:45:26.000Z",
        paymentIntentId: "payment-intent-1",
        sessionPaymentId: "payment-1",
      }),
    Error,
    "session_payment_paid_retry_not_claimed:patient_schedule_conflict",
  );
});

Deno.test("rejects a paid retry without its persisted checkout", async () => {
  const client = new StubPaymentsClient({ claimed: true });

  await assertRejects(
    () =>
      ensurePaidPaymentRetryAuthorization(client, {
        checkoutMode: "payment_retry",
        checkoutSessionId: null,
        eventId: "event-1",
        eventTime: "2026-09-27T14:45:26.000Z",
        paymentIntentId: "payment-intent-1",
        sessionPaymentId: "payment-1",
      }),
    Error,
    "session_payment_paid_retry_checkout_missing",
  );
  assertEquals(client.rpcCalls, []);
});
