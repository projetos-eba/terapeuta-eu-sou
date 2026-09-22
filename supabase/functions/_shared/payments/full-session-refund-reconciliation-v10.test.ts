import { reconcileUnknownFullSessionRefundsV10 } from "./full-session-refund-reconciliation-v10.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function harness(options: {
  availableCents: number;
  reversals?: Array<{
    id: string;
    amount: number;
    currency: string;
    created: number;
  }>;
  providerAmountReversed?: number;
}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let reversalPosts = 0;
  const client = {
    get(path: string) {
      if (path.includes("session_refund_decisions_v10")) {
        return Promise.resolve([
          {
            id: "decision_1",
            actor_user_id: "admin_1",
            session_payment_id: "payment_1",
            request_id: "request_1",
            reversal_attempted_at: "2026-09-22T20:00:00.000Z",
            stripe_transfer_id: "tr_original",
          },
        ]);
      }
      if (path.includes("session_payments")) {
        return Promise.resolve([
          {
            stripe_connect_account_id_snapshot: "acct_therapist",
          },
        ]);
      }
      throw new Error(`unexpected_get:${path}`);
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === "reconcile_full_session_refund_debt_v10_v2") {
        return Promise.resolve({ status: "reconciled", debtCents: 10_455 });
      }
      return Promise.resolve({});
    },
  };
  const stripe = {
    transfers: {
      retrieve: () =>
        Promise.resolve({
          id: "tr_original",
          amount: 10_455,
          amount_reversed:
            options.providerAmountReversed ??
            (options.reversals ?? []).reduce(
              (sum, item) => sum + item.amount,
              0,
            ),
          currency: "brl",
          destination: "acct_therapist",
          livemode: false,
        }),
      listReversals: () =>
        Promise.resolve({
          data: options.reversals ?? [],
          has_more: false,
        }),
      createReversal() {
        reversalPosts += 1;
        throw new Error("must_not_post");
      },
    },
    balance: {
      retrieve: () =>
        Promise.resolve({
          available: [{ amount: options.availableCents, currency: "brl" }],
        }),
    },
  };
  return { calls, client, stripe, reversalPosts: () => reversalPosts };
}

Deno.test(
  "read-only refund reconciliation creates debt after definitive insufficient balance",
  async () => {
    const h = harness({ availableCents: 0 });
    const result = await reconcileUnknownFullSessionRefundsV10({
      client: h.client as never,
      stripe: h.stripe as never,
      environment: "test",
      now: new Date("2026-09-22T22:00:00.000Z"),
    });

    assertEquals(result, [
      {
        decisionId: "decision_1",
        paymentId: "payment_1",
        reversedCents: 0,
        status: "completed",
        connectedAvailableCents: 0,
        debtCents: 10_455,
      },
    ]);
    assertEquals(h.reversalPosts(), 0);
    const transition = h.calls.find(
      (call) => call.name === "transition_full_session_refund_step_v10",
    );
    assertEquals(transition?.args.p_state, "unavailable");
    assertEquals(
      h.calls.filter(
        (call) => call.name === "reconcile_full_session_refund_debt_v10_v2",
      ).length,
      1,
    );
  },
);

Deno.test(
  "available connected balance leaves an ambiguous reversal fail closed",
  async () => {
    const h = harness({ availableCents: 20_000 });
    const result = await reconcileUnknownFullSessionRefundsV10({
      client: h.client as never,
      stripe: h.stripe as never,
      environment: "test",
      now: new Date("2026-09-22T22:00:00.000Z"),
    });

    assertEquals(result[0].status, "awaiting_provider_evidence");
    assertEquals(h.calls.length, 0);
    assertEquals(h.reversalPosts(), 0);
  },
);

Deno.test(
  "a provider reversal is reconciled without another POST",
  async () => {
    const h = harness({
      availableCents: 0,
      reversals: [
        {
          id: "trr_complete",
          amount: 10_455,
          currency: "brl",
          created: 1_795_000_000,
        },
      ],
    });
    const result = await reconcileUnknownFullSessionRefundsV10({
      client: h.client as never,
      stripe: h.stripe as never,
      environment: "test",
      now: new Date("2026-09-22T22:00:00.000Z"),
    });

    assertEquals(result[0].status, "completed");
    assertEquals(result[0].reversedCents, 10_455);
    assertEquals(h.reversalPosts(), 0);
    assertEquals(
      h.calls.some(
        (call) => call.name === "reconcile_session_transfer_reversal_v10",
      ),
      true,
    );
    assertEquals(
      h.calls.find(
        (call) => call.name === "transition_full_session_refund_step_v10",
      )?.args.p_state,
      "complete",
    );
  },
);

Deno.test("provider reversal history mismatch stays under review", async () => {
  const h = harness({
    availableCents: 0,
    providerAmountReversed: 10_455,
  });
  const result = await reconcileUnknownFullSessionRefundsV10({
    client: h.client as never,
    stripe: h.stripe as never,
    environment: "test",
    now: new Date("2026-09-22T22:00:00.000Z"),
  });

  assertEquals(result[0].status, "provider_history_requires_review");
  assertEquals(h.calls.length, 0);
  assertEquals(h.reversalPosts(), 0);
});

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}
