import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runSessionChargeWorker } from "./session-charge-worker.ts";

type WorkerInput = Parameters<typeof runSessionChargeWorker>[0];

const claim = {
  scheduleId: "a0000000-0000-4000-8000-000000000001",
  bookingId: "a0000000-0000-4000-8000-000000000002",
  bookingVersion: 2,
  sessionPaymentId: "a0000000-0000-4000-8000-000000000003",
  stripeEnvironment: "test",
  stripeCustomerId: "cus_test_patient",
  stripePaymentMethodId: "pm_test_booking_bound",
  amountCents: 17000,
  currency: "BRL",
  idempotencyKey: "tes:v10:session-charge:stable",
};

function makeInput(
  options: {
    onCreate?: (params: Record<string, unknown>, key: string) => unknown;
    onRecord?: (name: string, body: Record<string, unknown>) => unknown;
    claims?: unknown[];
  } = {},
) {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, body: Record<string, unknown>) => {
      calls.push({ name, body });
      if (name === "claim_due_session_payment_schedules_v10") {
        return { claims: options.claims ?? [claim] };
      }
      return options.onRecord?.(name, body) ?? { scheduleStatus: "paid" };
    },
  } as unknown as WorkerInput["client"];
  const stripe = {
    paymentIntents: {
      create: async (
        params: Record<string, unknown>,
        opts: { idempotencyKey: string },
      ) =>
        options.onCreate?.(params, opts.idempotencyKey) ?? {
          id: "pi_test_t24",
          amount: 17000,
          currency: "brl",
          customer: "cus_test_patient",
          payment_method: "pm_test_booking_bound",
          latest_charge: "ch_test_t24",
          status: "succeeded",
        },
    },
  } as unknown as WorkerInput["stripe"];
  return {
    calls,
    input: {
      client,
      stripe,
      environment: "test" as const,
      now: "2026-09-14T21:01:00.000Z",
      workerId: "a0000000-0000-4000-8000-000000000004",
      limit: 10,
    },
  };
}

Deno.test(
  "T-24 charges the reservation-bound card exactly once with a stable key",
  async () => {
    let createCalls = 0;
    const { input, calls } = makeInput({
      onCreate: (params, key) => {
        createCalls += 1;
        assertEquals(params.amount, 17000);
        assertEquals(params.currency, "brl");
        assertEquals(params.customer, "cus_test_patient");
        assertEquals(params.payment_method, "pm_test_booking_bound");
        assertEquals(params.off_session, true);
        assertEquals(params.confirm, true);
        assertEquals(key, claim.idempotencyKey);
        assertEquals(
          (params.metadata as Record<string, string>).tes_schedule_id,
          claim.scheduleId,
        );
        return undefined;
      },
    });
    const result = await runSessionChargeWorker(input);
    assertEquals(result, {
      claimed: 1,
      paid: 1,
      processing: 0,
      customerActionRequired: 0,
      retryScheduled: 0,
      failed: 0,
    });
    assertEquals(createCalls, 1);
    assertEquals(calls[1].name, "record_session_payment_intent_v10");
    assertEquals(calls[1].body.p_session_payment_id, claim.sessionPaymentId);
    assertEquals(calls[1].body.p_booking_version, 2);
  },
);

Deno.test(
  "a card requiring customer action is not retried automatically",
  async () => {
    const { input, calls } = makeInput({
      onCreate: () => ({
        id: "pi_test_action",
        amount: 17000,
        currency: "brl",
        customer: "cus_test_patient",
        payment_method: "pm_test_booking_bound",
        latest_charge: null,
        status: "requires_action",
      }),
      onRecord: () => ({ scheduleStatus: "requires_customer_action" }),
    });
    const result = await runSessionChargeWorker(input);
    assertEquals(result.customerActionRequired, 1);
    assertEquals(
      calls.some(
        (call) => call.name === "fail_session_payment_schedule_attempt_v10",
      ),
      false,
    );
  },
);

Deno.test(
  "an ambiguous Stripe failure schedules retry on the same claim",
  async () => {
    const { input, calls } = makeInput({
      onCreate: () => {
        throw new Error("socket closed");
      },
      onRecord: () => ({ status: "retry_scheduled" }),
    });
    const result = await runSessionChargeWorker(input);
    assertEquals(result.retryScheduled, 1);
    assertEquals(calls[1].name, "fail_session_payment_schedule_attempt_v10");
    assertEquals(calls[1].body.p_error_code, "stripe_state_unknown");
  },
);

Deno.test(
  "an environment mismatch fails closed before Stripe is called",
  async () => {
    let called = false;
    const { input } = makeInput({
      claims: [{ ...claim, stripeEnvironment: "live" }],
      onCreate: () => {
        called = true;
      },
    });
    let rejected = false;
    try {
      await runSessionChargeWorker(input);
    } catch {
      rejected = true;
    }
    assertEquals(rejected, true);
    assertEquals(called, false);
  },
);
