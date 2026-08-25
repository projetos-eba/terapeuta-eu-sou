import {
  buildConnectedPayoutParams,
  classifyProviderFailure,
  selectConnectedPayoutBalance,
} from "./payouts.ts";

declare const Deno: { test(name: string, fn: () => void): void };

Deno.test("payout selects one authoritative BRL source type", () => {
  const decision = selectConnectedPayoutBalance({
    available: [{ amount: 15000, currency: "brl", source_types: { bank_account: 15000, card: 0, fpx: 0 } }],
  } as never, 12000);
  assertEquals(decision.kind, "ready");
  if (decision.kind === "ready") assertEquals(decision.sourceType, "bank_account");
});

Deno.test("payout waits for available BRL balance without failing", () => {
  const decision = selectConnectedPayoutBalance({
    available: [{ amount: 5000, currency: "brl", source_types: { bank_account: 5000 } }],
  } as never, 12000);
  assertEquals(decision.kind, "pending_balance");
});

Deno.test("payout fails closed when source types are ambiguous", () => {
  const decision = selectConnectedPayoutBalance({
    available: [{ amount: 24000, currency: "brl", source_types: { bank_account: 12000, card: 12000 } }],
  } as never, 12000);
  assertEquals(decision.kind, "reconciliation_required");
});

Deno.test("payout parameters aggregate only the persisted group amount", () => {
  const params = buildConnectedPayoutParams({
    amountCents: 12000,
    batchId: "batch",
    payoutBatchTherapistId: "group",
    sourceType: "bank_account",
    therapistProfileId: "therapist",
  });
  assertEquals(params.amount, 12000);
  assertEquals(params.currency, "brl");
  assertEquals(params.method, "standard");
  assertEquals(params.metadata?.tes_payout_batch_therapist_id, "group");
});

Deno.test("ambiguous provider timeouts require reconciliation", () => {
  const failure = classifyProviderFailure({ code: "ETIMEDOUT", message: "timeout after acct_123" });
  assertEquals(failure.disposition, "reconciliation_required");
  assertEquals(failure.message.includes("acct_123"), false);
});

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
}
