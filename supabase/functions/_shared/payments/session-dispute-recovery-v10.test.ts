import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  runLostSessionDisputeRecoveryV10,
  type SessionDisputeProjectionV10,
} from "./session-dispute-recovery-v10.ts";

const projection: SessionDisputeProjectionV10 = {
  applied: true,
  disputeStatus: "lost",
  paymentFlowVersion: "v10",
  providerReversalAmountCents: 10_455,
  recoveryAmountCents: 10_455,
  recoveryState: "not_attempted",
  sessionPaymentId: "payment-1",
  stripeAccountId: "acct_connected",
  stripeChargeId: "ch_source",
  stripeDisputeId: "dp_lost",
  stripeEnvironment: "test",
  stripeTransferId: "tr_direct",
  therapistProfileId: "therapist-1",
};

function clientMock(claimed = true) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      async rpc<T>(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return (name === "claim_session_dispute_recovery_v10" ? claimed : {}) as T;
      },
    },
  };
}

function stripeMock(input?: {
  createError?: unknown;
  reversals?: Array<{
    amount: number;
    created: number;
    currency: string;
    id: string;
    metadata?: Record<string, string>;
  }>;
}) {
  let createCalls = 0;
  const reversals = input?.reversals ?? [];
  return {
    get createCalls() {
      return createCalls;
    },
    stripe: {
      transfers: {
        async retrieve() {
          return {
            amount: 10_455,
            currency: "brl",
            destination: "acct_connected",
            livemode: false,
            source_transaction: "ch_source",
          };
        },
        async *listReversals() {
          for (const reversal of reversals) yield reversal;
        },
        async createReversal() {
          createCalls += 1;
          if (input?.createError) throw input.createError;
          return {
            amount: 10_455,
            created: 1_790_000_000,
            currency: "brl",
            id: "trr_created",
          };
        },
      },
    },
  };
}

Deno.test("a lost V10 dispute reverses the transfer once and completes recovery", async () => {
  const { client, calls } = clientMock();
  const provider = stripeMock();
  const result = await runLostSessionDisputeRecoveryV10({
    client: client as never,
    eventId: "evt_lost",
    eventTime: "2026-09-27T18:00:00.000Z",
    projection,
    stripe: provider.stripe as never,
  });

  assertEquals(result.status, "recovered");
  assertEquals(provider.createCalls, 1);
  assertExists(
    calls.find(
      (call) => call.name === "reconcile_session_dispute_transfer_reversal_v10",
    ),
  );
  assertExists(
    calls.find(
      (call) => call.name === "complete_session_dispute_recovery_v10",
    ),
  );
});

Deno.test("an existing dispute reversal is reconciled without another provider write", async () => {
  const { client } = clientMock(false);
  const provider = stripeMock({
    reversals: [
      {
        amount: 10_455,
        created: 1_790_000_000,
        currency: "brl",
        id: "trr_existing",
        metadata: { tes_stripe_dispute_id: "dp_lost" },
      },
    ],
  });
  const result = await runLostSessionDisputeRecoveryV10({
    client: client as never,
    eventId: "evt_retry",
    eventTime: "2026-09-27T18:01:00.000Z",
    projection: { ...projection, recoveryState: "attempting" },
    stripe: provider.stripe as never,
  });

  assertEquals(result.status, "recovered");
  assertEquals(provider.createCalls, 0);
});

Deno.test("an interrupted recovery never repeats a provider write without reversal evidence", async () => {
  const { client, calls } = clientMock(false);
  const provider = stripeMock();
  const result = await runLostSessionDisputeRecoveryV10({
    client: client as never,
    eventId: "evt_interrupted",
    eventTime: "2026-09-27T18:01:30.000Z",
    projection: { ...projection, recoveryState: "attempting" },
    stripe: provider.stripe as never,
  });

  assertEquals(result.status, "needs_review");
  assertEquals(provider.createCalls, 0);
  assertExists(
    calls.find(
      (call) =>
        call.name === "mark_session_dispute_recovery_review_v10" &&
        call.args.p_state === "unknown",
    ),
  );
});

Deno.test("definitive connected balance shortage becomes therapist debt", async () => {
  const { client, calls } = clientMock();
  const provider = stripeMock({
    createError: { code: "balance_insufficient", statusCode: 400 },
  });
  const result = await runLostSessionDisputeRecoveryV10({
    client: client as never,
    eventId: "evt_shortfall",
    eventTime: "2026-09-27T18:02:00.000Z",
    projection,
    stripe: provider.stripe as never,
  });

  assertEquals(result.status, "debt_recorded");
  const completion = calls.find(
    (call) => call.name === "complete_session_dispute_recovery_v10",
  );
  assertEquals(completion?.args.p_definitive_provider_shortfall, true);
});

Deno.test("an ambiguous provider write is not retried blindly", async () => {
  const { client, calls } = clientMock();
  const provider = stripeMock({ createError: new Error("network timeout") });
  const result = await runLostSessionDisputeRecoveryV10({
    client: client as never,
    eventId: "evt_ambiguous",
    eventTime: "2026-09-27T18:03:00.000Z",
    projection,
    stripe: provider.stripe as never,
  });

  assertEquals(result.status, "needs_review");
  assertEquals(provider.createCalls, 1);
  assertExists(
    calls.find(
      (call) =>
        call.name === "mark_session_dispute_recovery_review_v10" &&
        call.args.p_state === "unknown",
    ),
  );
  assertEquals(
    calls.some(
      (call) => call.name === "complete_session_dispute_recovery_v10",
    ),
    false,
  );
});

Deno.test("a fully offset therapist amount creates debt without a Stripe reversal", async () => {
  const { client, calls } = clientMock();
  const provider = stripeMock();
  const result = await runLostSessionDisputeRecoveryV10({
    client: client as never,
    eventId: "evt_offset",
    eventTime: "2026-09-27T18:04:00.000Z",
    projection: {
      ...projection,
      providerReversalAmountCents: 0,
      stripeTransferId: null,
    },
    stripe: provider.stripe as never,
  });

  assertEquals(result.status, "debt_recorded");
  assertEquals(provider.createCalls, 0);
  assertExists(
    calls.find(
      (call) => call.name === "complete_session_dispute_recovery_v10",
    ),
  );
});
