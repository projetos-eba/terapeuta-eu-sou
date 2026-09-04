import {
  extractChargeSettlementSnapshot,
  isChargeSettlementAvailable,
  refreshRecoverableConnectPayments,
} from "./charge-settlement.ts";
import type { SupabaseRestClient } from "../auth/supabase-rest.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

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
  "rechecks payments blocked only because Connect was not ready",
  async () => {
    const requests: Array<{ body?: unknown; name?: string; path?: string }> =
      [];
    const client = {
      get: (path: string) => {
        requests.push({ path });
        return Promise.resolve([{ id: "payment-connect-ready" }]);
      },
      rpc: (name: string, body: unknown) => {
        requests.push({ body, name });
        return Promise.resolve({ transferStatus: "waiting_settlement" });
      },
    } as unknown as SupabaseRestClient;

    const results = await refreshRecoverableConnectPayments({ client });

    assertEquals(results.length, 1);
    assertEquals(
      requests[0]?.path,
      "/rest/v1/session_payments?select=id&financial_status=in.(paid,partially_refunded)&transfer_status=eq.blocked&transfer_blocked_reason=eq.connect_not_ready&order=updated_at.asc&limit=500",
    );
    assertEquals(requests[1]?.name, "refresh_session_transfer_eligibility");
    assertEquals(
      (requests[1]?.body as { p_session_payment_id?: string })
        ?.p_session_payment_id,
      "payment-connect-ready",
    );
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
