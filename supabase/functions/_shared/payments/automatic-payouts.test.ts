import {
  extractTransferDestinationReference,
  sanitizePayoutBalanceTransaction,
} from "./automatic-payouts.ts";

declare const Deno: { test(name: string, fn: () => void): void };

Deno.test("Transfer destination reference preserves connected balance authority", () => {
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
});

Deno.test("Transfer destination string remains reconcilable without an expanded object", () => {
  const reference = extractTransferDestinationReference({
    destination_payment: "py_destination",
  } as never);
  assertEquals(reference?.destinationPaymentId, "py_destination");
  assertEquals(reference?.balanceTransactionId, null);
});

Deno.test("Payout reconciliation sends only allowlisted Balance Transaction fields", () => {
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
});

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}
