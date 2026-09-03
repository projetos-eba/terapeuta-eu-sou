import {
  extractChargeSettlementSnapshot,
  isChargeSettlementAvailable,
} from "./charge-settlement.ts";

declare const Deno: { test(name: string, fn: () => void): void };

Deno.test(
  "extracts the authoritative source Charge Balance Transaction",
  () => {
    const snapshot = extractChargeSettlementSnapshot({
      balance_transaction: {
        amount: 12_300,
        available_on: 1_788_000_000,
        currency: "BRL",
        fee: 1_845,
        id: "txn_settlement",
        net: 10_455,
        source: "ch_source",
        status: "available",
      },
      id: "ch_source",
    });

    assertEquals(snapshot?.balanceTransactionId, "txn_settlement");
    assertEquals(snapshot?.status, "available");
    assertEquals(snapshot?.currency, "brl");
    assertEquals(snapshot?.availableOn, "2026-08-29T10:40:00.000Z");
  },
);

Deno.test(
  "rejects a Balance Transaction that does not belong to the Charge",
  () => {
    const snapshot = extractChargeSettlementSnapshot({
      balance_transaction: {
        amount: 12_300,
        available_on: 1_788_000_000,
        currency: "brl",
        id: "txn_settlement",
        source: "ch_other",
        status: "available",
      },
      id: "ch_source",
    });

    assertEquals(snapshot, null);
  },
);

Deno.test(
  "availability gate validates status, identifiers, amount, currency and instant",
  () => {
    const snapshot = {
      amountCents: 12_300,
      availableOn: "2026-08-29T10:40:00.000Z",
      balanceTransactionId: "txn_settlement",
      currency: "brl",
      feeAmountCents: 1_845,
      netAmountCents: 10_455,
      sourceChargeId: "ch_source",
      status: "available" as const,
    };

    assertEquals(
      isChargeSettlementAvailable(snapshot, {
        amountCents: 12_300,
        balanceTransactionId: "txn_settlement",
        chargeId: "ch_source",
        operationInstant: "2026-08-29T10:40:00.000Z",
      }),
      true,
    );
    assertEquals(
      isChargeSettlementAvailable(snapshot, {
        amountCents: 12_300,
        balanceTransactionId: "txn_settlement",
        chargeId: "ch_source",
        operationInstant: "2026-08-29T10:39:59.999Z",
      }),
      false,
    );
  },
);

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}
