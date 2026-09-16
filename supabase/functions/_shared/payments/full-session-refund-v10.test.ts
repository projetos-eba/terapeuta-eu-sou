import { runFullSessionRefundV10 } from "./full-session-refund-v10.ts";

declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

const paymentId = "b1190000-0000-4000-8000-000000000021";
const requestId = "b1190000-0000-4000-8000-000000000051";
const reason = "Sessão não realizada, devolução integral aprovada pelo suporte.";

function harness(options: {
  reversalError?: unknown;
  existingPartialRefund?: boolean;
  existingDecision?: boolean;
} = {}) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const state = {
    reversal: options.existingDecision ? "unknown" : "not_attempted",
    refund: options.existingDecision ? "unknown" : "not_attempted",
  };
  const reversals: Array<Record<string, unknown>> = [];
  const refunds: Array<Record<string, unknown>> = options.existingPartialRefund
    ? [{
      id: "re_partial",
      amount: 2000,
      currency: "brl",
      status: "succeeded",
      created: 1_789_000_000,
    }]
    : [];
  const client = {
    get(path: string) {
      if (path.includes("session_refund_decisions_v10")) {
        return Promise.resolve(
          options.existingDecision
            ? [{
              id: "decision_1",
              actor_user_id: "admin_1",
              session_payment_id: paymentId,
              request_id: requestId,
              reason,
              amount_cents: 10_000,
              stripe_charge_id: "ch_original",
              stripe_transfer_id: "tr_original",
              reversal_state: state.reversal,
              refund_state: state.refund,
            }]
            : [],
        );
      }
      if (path.includes("session_payments")) {
        return Promise.resolve([{
          stripe_payment_intent_id: "pi_original",
          stripe_connect_account_id_snapshot: "acct_frozen",
          gross_amount_cents: 10_000,
        }]);
      }
      throw new Error(`unexpected_get:${path}`);
    },
    rpc(name: string, args: unknown) {
      calls.push({ name, args });
      if (name === "claim_full_session_refund_v10_v3") {
        return Promise.resolve({
          decisionId: "decision_1",
          amountCents: 10_000,
          chargeId: "ch_original",
          transferId: "tr_original",
          reversalState: "not_attempted",
          refundState: "not_attempted",
          existing: false,
        });
      }
      if (name === "transition_full_session_refund_step_v10") {
        const transition = args as { p_step: string; p_state: string };
        if (transition.p_step === "reversal") state.reversal = transition.p_state;
        if (transition.p_step === "refund") state.refund = transition.p_state;
        return Promise.resolve({});
      }
      if (name === "reconcile_full_session_refund_debt_v10_v2") {
        return Promise.resolve({
          status: state.reversal === "unknown"
            ? "recovery_requires_review"
            : "reconciled",
        });
      }
      if (name === "complete_therapist_change_refund_v1") {
        return Promise.resolve({ completed: false });
      }
      if (name.startsWith("reconcile_session_")) return Promise.resolve({});
      throw new Error(`unexpected_rpc:${name}`);
    },
  };
  let reversalPosts = 0;
  let refundPosts = 0;
  const stripe = {
    charges: {
      retrieve: () =>
        Promise.resolve({
          paid: true,
          status: "succeeded",
          amount: 10_000,
          currency: "brl",
          livemode: false,
          payment_intent: "pi_original",
        }),
    },
    transfers: {
      retrieve: () =>
        Promise.resolve({
          id: "tr_original",
          source_transaction: "ch_original",
          destination: "acct_frozen",
          currency: "brl",
          livemode: false,
          amount: 8500,
        }),
      listReversals: () => Promise.resolve({ data: reversals, has_more: false }),
      createReversal(_id: string, _body: unknown, _options: unknown) {
        reversalPosts += 1;
        if (options.reversalError) return Promise.reject(options.reversalError);
        const reversal = {
          id: "trr_one",
          amount: 8500,
          currency: "brl",
          created: 1_789_000_000,
        };
        reversals.push(reversal);
        return Promise.resolve(reversal);
      },
    },
    refunds: {
      list: () => Promise.resolve({ data: refunds, has_more: false }),
      create(_body: unknown, _options: unknown) {
        refundPosts += 1;
        const refund = {
          id: "re_full",
          amount: 10_000,
          currency: "brl",
          status: "succeeded",
          reason: null,
          created: 1_789_000_000,
        };
        refunds.push(refund);
        return Promise.resolve(refund);
      },
    },
  };
  return {
    calls,
    client,
    stripe,
    state,
    counts: () => ({ reversalPosts, refundPosts }),
  };
}

function run(h: ReturnType<typeof harness>) {
  return runFullSessionRefundV10({
    client: h.client as never,
    stripe: h.stripe as never,
    environment: "test",
    actorUserId: "admin_1",
    paymentId,
    requestId,
    reason,
  });
}

Deno.test("full refund reverses the frozen Transfer once and refunds the complete Charge", async () => {
  const h = harness();
  const result = await run(h);
  assertEquals(result.status, "completed");
  assertEquals(h.counts(), { reversalPosts: 1, refundPosts: 1 });
  const reversal = h.calls.find((call) =>
    call.name === "reconcile_session_transfer_reversal_v10"
  );
  const refund = h.calls.find((call) =>
    call.name === "reconcile_session_refund_event_v10"
  );
  assertEquals((reversal?.args as Record<string, unknown>).p_amount_cents, 8500);
  assertEquals((refund?.args as Record<string, unknown>).p_amount_cents, 10_000);
  assertEquals(
    h.calls.filter((call) => call.name === "complete_therapist_change_refund_v1")
      .length,
    1,
  );
});

Deno.test("insufficient connected balance does not prevent the full customer refund", async () => {
  const h = harness({ reversalError: { code: "balance_insufficient" } });
  const result = await run(h);
  assertEquals(result.status, "completed");
  assertEquals(h.state.reversal, "unavailable");
  assertEquals(h.counts(), { reversalPosts: 1, refundPosts: 1 });
  assertEquals(
    h.calls.filter((call) => call.name === "reconcile_full_session_refund_debt_v10_v2")
      .length,
    1,
  );
});

Deno.test("uncertain reversal is never reposted on follow-up", async () => {
  const h = harness({
    reversalError: new Error("connection reset"),
    existingDecision: true,
  });
  const result = await run(h);
  assertEquals(result.status, "needs_review");
  assertEquals(h.counts(), { reversalPosts: 0, refundPosts: 0 });
});

Deno.test("provider-side partial refund stops before any new provider mutation", async () => {
  const h = harness({ existingPartialRefund: true });
  let failed = false;
  try {
    await run(h);
  } catch {
    failed = true;
  }
  assertEquals(failed, true);
  assertEquals(h.counts(), { reversalPosts: 0, refundPosts: 0 });
});

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}
