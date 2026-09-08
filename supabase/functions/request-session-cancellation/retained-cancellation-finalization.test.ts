import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { finalizeRetainedCancellation } from "./retained-cancellation-finalization.ts";

Deno.test(
  "a fully retained cancellation closes the service without opening a refund review",
  async () => {
    const calls: string[] = [];

    await finalizeRetainedCancellation(
      {
        bookingId: "b1000000-0000-4000-8000-000000000001",
        cancelledAt: "2026-09-06T12:00:00.000Z",
        decisionId: "d1000000-0000-4000-8000-000000000001",
        internalReason: "patient_cancellation",
        paymentId: "p1000000-0000-4000-8000-000000000001",
      },
      {
        markBookingCancellation: async () => {
          calls.push("booking-metadata");
        },
        markDecisionProcessed: async () => {
          calls.push("decision-processed");
        },
        refreshTransferEligibility: async () => {
          calls.push("eligibility-refreshed");
        },
        transitionBookingCancellation: async () => {
          calls.push("booking-transition");
        },
        updatePayment: async () => {
          calls.push("payment-closed-without-refund");
        },
      },
    );

    assertEquals(calls, [
      "booking-transition",
      "payment-closed-without-refund",
      "booking-metadata",
      "decision-processed",
      "eligibility-refreshed",
    ]);
  },
);
