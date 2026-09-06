import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { finalizeAutomaticRefund } from "./automatic-refund-finalization.ts";

const baseInput = {
  bookingId: "b1000000-0000-4000-8000-000000000001",
  cancelledAt: "2026-09-06T12:00:00.000Z",
  decisionId: "d1000000-0000-4000-8000-000000000001",
  grossAmountCents: 12300,
  internalReason: "patient_cancellation",
  paymentId: "p1000000-0000-4000-8000-000000000001",
  refundAmountCents: 12300,
};

Deno.test(
  "a full refund relies on the payment trigger and completes without a stale booking transition",
  async () => {
    const calls: string[] = [];
    const result = await finalizeAutomaticRefund(baseInput, operations(calls));

    assertEquals(result, "refunded");
    assertEquals(calls, [
      "payment:refunded",
      "booking-metadata",
      "decision-processed",
    ]);
  },
);

Deno.test(
  "a partial refund cancels the booking before updating the payment projection",
  async () => {
    const calls: string[] = [];
    const result = await finalizeAutomaticRefund(
      { ...baseInput, refundAmountCents: 5000 },
      operations(calls),
    );

    assertEquals(result, "partially_refunded");
    assertEquals(calls, [
      "booking-transition",
      "payment:partially_refunded",
      "booking-metadata",
      "decision-processed",
    ]);
  },
);

function operations(calls: string[]) {
  return {
    markBookingCancellation: async () => {
      calls.push("booking-metadata");
    },
    markDecisionProcessed: async () => {
      calls.push("decision-processed");
    },
    transitionBookingCancellation: async () => {
      calls.push("booking-transition");
    },
    updatePayment: async ({ financialStatus }: { financialStatus: string }) => {
      calls.push(`payment:${financialStatus}`);
    },
  };
}
