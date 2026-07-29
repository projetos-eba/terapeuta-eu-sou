import {
  buildSessionTransferCreateParams,
  isSessionPaymentTransferable,
  resolveFinanceOperationInstant,
} from "./finance-lifecycle.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test(
  "finance test clock override is denied outside explicit test controls",
  () => {
    assertThrows(() =>
      resolveFinanceOperationInstant({
        config: { financeTestControlsEnabled: false, stripeMode: "test" },
        defaultInstant: "2026-07-29T10:00:00.000Z",
        fieldName: "now_override",
        override: "2026-08-05T10:00:00.000Z",
      }),
    );
  },
);

Deno.test("finance test clock override is denied in live mode", () => {
  assertThrows(() =>
    resolveFinanceOperationInstant({
      config: { financeTestControlsEnabled: true, stripeMode: "live" },
      defaultInstant: "2026-07-29T10:00:00.000Z",
      fieldName: "cutoff_at_override",
      override: "2026-08-05T10:00:00.000Z",
    }),
  );
});

Deno.test(
  "finance test clock override normalizes ISO instants in test mode",
  () => {
    const instant = resolveFinanceOperationInstant({
      config: { financeTestControlsEnabled: true, stripeMode: "test" },
      defaultInstant: "2026-07-29T10:00:00.000Z",
      fieldName: "now_override",
      override: "2026-08-05T07:00:00-03:00",
    });

    assertEquals(instant, "2026-08-05T10:00:00.000Z");
  },
);

Deno.test(
  "session transfer params include source_transaction and TES metadata",
  () => {
    const params = buildSessionTransferCreateParams({
      amountCents: 16_000,
      batchId: "batch_123",
      bookingId: "booking_123",
      destination: "acct_123",
      itemId: "item_123",
      sessionPaymentId: "payment_123",
      sourceChargeId: "ch_123",
      therapistProfileId: "therapist_123",
    });

    assertEquals(params.amount, 16_000);
    assertEquals(params.currency, "brl");
    assertEquals(params.destination, "acct_123");
    assertEquals(params.source_transaction, "ch_123");
    assertEquals(params.transfer_group, "tes_booking_booking_123");
    assertEquals(params.metadata.tes_session_payment_id, "payment_123");
  },
);

Deno.test(
  "only paid batched payments with source charge are transferable",
  () => {
    assertEquals(
      isSessionPaymentTransferable({
        financialStatus: "paid",
        refundPending: false,
        stripeChargeId: "ch_123",
        transferStatus: "batched",
      }),
      true,
    );
    assertEquals(
      isSessionPaymentTransferable({
        financialStatus: "paid",
        refundPending: false,
        stripeChargeId: null,
        transferStatus: "batched",
      }),
      false,
    );
    assertEquals(
      isSessionPaymentTransferable({
        financialStatus: "partially_refunded",
        refundPending: false,
        stripeChargeId: "ch_123",
        transferStatus: "batched",
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

function assertThrows(fn: () => void) {
  try {
    fn();
  } catch {
    return;
  }

  throw new Error("Expected function to throw.");
}
