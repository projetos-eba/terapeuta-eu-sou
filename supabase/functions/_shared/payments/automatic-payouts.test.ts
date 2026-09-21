import {
  annotateVerifiedPayoutRefunds,
  extractTransferDestinationReference,
  isAllocatablePayoutBalanceTransaction,
  sanitizePayoutBalanceTransaction,
  syncAutomaticStripePayout,
} from "./automatic-payouts.ts";

declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

Deno.test(
  "Transfer destination reference preserves connected balance authority",
  () => {
    const reference = extractTransferDestinationReference({
      destination_payment: {
        id: "py_destination",
        balance_transaction: {
          id: "txn_connected",
          available_on: 1_788_000_000,
        },
      },
    } as never);
    assertEquals(reference?.destinationPaymentId, "py_destination");
    assertEquals(reference?.balanceTransactionId, "txn_connected");
    assertEquals(reference?.availableOn, "2026-08-29T10:40:00.000Z");
  },
);

Deno.test(
  "Transfer destination string remains reconcilable without an expanded object",
  () => {
    const reference = extractTransferDestinationReference({
      destination_payment: "py_destination",
    } as never);
    assertEquals(reference?.destinationPaymentId, "py_destination");
    assertEquals(reference?.balanceTransactionId, null);
  },
);

Deno.test(
  "Payout reconciliation sends only allowlisted Balance Transaction fields",
  () => {
    const sanitized = sanitizePayoutBalanceTransaction({
      amount: 10_000,
      available_on: 1_788_000_000,
      currency: "brl",
      id: "txn_connected",
      net: 10_000,
      reporting_category: "transfer",
      source: "py_destination",
      type: "payment",
      description: "must not cross the RPC boundary",
    } as never);
    assertEquals(sanitized.source, "py_destination");
    assertEquals("description" in sanitized, false);
  },
);

Deno.test("Payout allocation excludes the aggregate payout debit", () => {
  assertEquals(
    isAllocatablePayoutBalanceTransaction({
      reporting_category: "payout",
      type: "payout",
    } as never),
    false,
  );
  assertEquals(
    isAllocatablePayoutBalanceTransaction({
      reporting_category: "transfer",
      type: "payment",
    } as never),
    true,
  );
});

Deno.test("only a provider-verified refund annotates a neutral payout pair", async () => {
  const transactions: Parameters<typeof annotateVerifiedPayoutRefunds>[0] = [
    {
      id: "txn_payment",
      source: "py_original",
      type: "payment",
      reporting_category: "transfer",
      amount: 10455,
      net: 10455,
      currency: "brl",
      available_on: 1_788_000_000,
    },
    {
      id: "txn_refund",
      source: "pyr_refund",
      type: "payment_refund",
      reporting_category: "transfer_refund",
      amount: -10455,
      net: -10455,
      currency: "brl",
      available_on: 1_788_000_000,
    },
  ];
  const stripe = {
    refunds: {
      retrieve: async () => ({
        status: "succeeded",
        amount: 10455,
        currency: "brl",
        charge: "py_original",
        balance_transaction: "txn_refund",
      }),
    },
  } as never;
  const annotated = await annotateVerifiedPayoutRefunds(
    transactions,
    stripe,
    "acct_test",
  );
  assertEquals(annotated[1].verified_refund_charge, "py_original");

  const wrongBalance = {
    refunds: {
      retrieve: async () => ({
        status: "succeeded",
        amount: 10455,
        currency: "brl",
        charge: "py_original",
        balance_transaction: "txn_other",
      }),
    },
  } as never;
  const rejected = await annotateVerifiedPayoutRefunds(
    transactions,
    wrongBalance,
    "acct_test",
  );
  assertEquals(rejected[1].verified_refund_charge, undefined);
});

Deno.test("equal but unrelated provider movements are not paired", async () => {
  const transactions: Parameters<typeof annotateVerifiedPayoutRefunds>[0] = [
    {
      id: "txn_payment",
      source: "py_unrelated",
      type: "payment",
      reporting_category: "transfer",
      amount: 10455,
      net: 10455,
      currency: "brl",
      available_on: 1_788_000_000,
    },
    {
      id: "txn_refund",
      source: "pyr_refund",
      type: "payment_refund",
      reporting_category: "transfer_refund",
      amount: -10455,
      net: -10455,
      currency: "brl",
      available_on: 1_788_000_000,
    },
  ];
  const stripe = {
    refunds: {
      retrieve: async () => ({
        status: "succeeded",
        amount: 10455,
        currency: "brl",
        charge: "py_original",
        balance_transaction: "txn_refund",
      }),
    },
  } as never;
  const annotated = await annotateVerifiedPayoutRefunds(
    transactions,
    stripe,
    "acct_test",
  );
  assertEquals(annotated[1].verified_refund_charge, undefined);
});

Deno.test("automatic payout sync sends verified evidence only to reconciliation v2", async () => {
  const calls: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, payload: Record<string, unknown>) => {
      calls.push({ name, payload });
      return name === "record_automatic_stripe_payout_v1"
        ? { payoutId: "local-payout" }
        : { reconciled: true };
    },
  } as never;
  const stripe = {
    balanceTransactions: {
      list: async () => ({
        has_more: false,
        data: [
          {
            id: "txn_payment",
            source: "py_original",
            type: "payment",
            reporting_category: "transfer",
            amount: 10455,
            net: 10455,
            currency: "brl",
            available_on: 1_788_000_000,
          },
          {
            id: "txn_refund",
            source: "pyr_refund",
            type: "payment_refund",
            reporting_category: "transfer_refund",
            amount: -10455,
            net: -10455,
            currency: "brl",
            available_on: 1_788_000_000,
          },
        ],
      }),
    },
    refunds: {
      retrieve: async () => ({
        status: "succeeded",
        amount: 10455,
        currency: "brl",
        charge: "py_original",
        balance_transaction: "txn_refund",
      }),
    },
  } as never;
  await syncAutomaticStripePayout({
    accountId: "acct_test",
    client,
    eventCreatedAt: "2026-09-21T21:00:00Z",
    eventId: "evt_test",
    payout: {
      id: "po_test",
      automatic: true,
      livemode: false,
      currency: "brl",
      amount: 10455,
      status: "paid",
      reconciliation_status: "completed",
    } as never,
    stripe,
    stripeMode: "test",
  });
  assertEquals(calls[1].name, "reconcile_automatic_stripe_payout_v2");
  const movements = calls[1].payload.p_balance_transactions as Array<
    Record<string, unknown>
  >;
  assertEquals(movements[1].verified_refund_charge, "py_original");
});

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}
