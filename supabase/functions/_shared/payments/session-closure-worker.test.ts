import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runSessionClosureWorker } from "./session-closure-worker.ts";

type WorkerInput = Parameters<typeof runSessionClosureWorker>[0];

const candidate = {
  amountCents: 17000,
  bookingId: "a0000000-0000-4000-8000-000000000101",
  bookingVersion: 2,
  currency: "BRL",
  idempotencyKey: "tes:v10:session-charge:closure",
  scheduleId: "a0000000-0000-4000-8000-000000000102",
  scheduleStatus: "requires_customer_action",
  sessionPaymentId: "a0000000-0000-4000-8000-000000000103",
  stripeCustomerId: "cus_closure",
  stripeEnvironment: "test",
  stripePaymentIntentId: "pi_closure",
  stripePaymentMethodId: "pm_closure",
};

function intent(status: string) {
  return {
    amount: 17000,
    currency: "brl",
    customer: "cus_closure",
    id: "pi_closure",
    latest_charge: status === "succeeded" ? "ch_closure" : null,
    payment_method: "pm_closure",
    status,
  };
}

function makeInput(
  options: {
    item?: Record<string, unknown>;
    retrieveStatus?: string;
    cancelStatus?: string;
  } = {},
) {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, body: Record<string, unknown>) => {
      calls.push({ name, body });
      if (name === "list_due_session_payment_closures_v10") {
        return { items: [{ ...candidate, ...options.item }] };
      }
      return { closed: true };
    },
  } as unknown as WorkerInput["client"];
  const stripeCalls: string[] = [];
  const stripe = {
    paymentIntents: {
      cancel: async () => {
        stripeCalls.push("cancel");
        return intent(options.cancelStatus ?? "canceled");
      },
      retrieve: async () => {
        stripeCalls.push("retrieve");
        return intent(options.retrieveStatus ?? "requires_action");
      },
    },
  } as unknown as WorkerInput["stripe"];
  return {
    calls,
    input: {
      client,
      environment: "test" as const,
      limit: 10,
      now: "2026-09-15T21:00:00.000Z",
      stripe,
    },
    stripeCalls,
  };
}

Deno.test(
  "an uncreated payment closes only after the session start",
  async () => {
    const { calls, input, stripeCalls } = makeInput({
      item: { scheduleStatus: "scheduled", stripePaymentIntentId: null },
    });
    const result = await runSessionClosureWorker(input);
    assertEquals(result, { candidates: 1, closed: 1, paid: 0, pending: 0 });
    assertEquals(stripeCalls, []);
    assertEquals(calls[1].name, "close_unpaid_session_payment_v10");
    assertEquals(calls[1].body.p_observed_stripe_status, "not_created");
  },
);

Deno.test(
  "customer action is canceled at Stripe before the booking closes",
  async () => {
    const { calls, input, stripeCalls } = makeInput();
    const result = await runSessionClosureWorker(input);
    assertEquals(result.closed, 1);
    assertEquals(stripeCalls, ["retrieve", "cancel"]);
    assertEquals(calls[1].name, "close_unpaid_session_payment_v10");
    assertEquals(calls[1].body.p_observed_stripe_status, "canceled");
  },
);

Deno.test(
  "a late Stripe success is reconciled and never canceled",
  async () => {
    const { calls, input, stripeCalls } = makeInput({
      retrieveStatus: "succeeded",
    });
    const result = await runSessionClosureWorker(input);
    assertEquals(result, { candidates: 1, closed: 0, paid: 1, pending: 0 });
    assertEquals(stripeCalls, ["retrieve"]);
    assertEquals(calls[1].name, "record_session_payment_intent_v10");
    assertEquals(
      calls.some((call) => call.name === "close_unpaid_session_payment_v10"),
      false,
    );
  },
);

Deno.test(
  "a processing payment stays closed to the room and opens an incident",
  async () => {
    const { calls, input } = makeInput({ retrieveStatus: "processing" });
    const result = await runSessionClosureWorker(input);
    assertEquals(result.pending, 1);
    assertEquals(calls[1].name, "open_session_charge_incident_v10");
    assertEquals(calls[1].body.p_code, "payment_processing_at_session_start");
  },
);

Deno.test(
  "an unknown in-flight claim is not canceled without a Stripe id",
  async () => {
    const { calls, input } = makeInput({
      item: { scheduleStatus: "claimed", stripePaymentIntentId: null },
    });
    const result = await runSessionClosureWorker(input);
    assertEquals(result.pending, 1);
    assertEquals(calls[1].name, "open_session_charge_incident_v10");
    assertEquals(
      calls.some((call) => call.name === "close_unpaid_session_payment_v10"),
      false,
    );
  },
);
