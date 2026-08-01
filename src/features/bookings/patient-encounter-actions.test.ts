import { describe, expect, it } from "vitest";

import { BookingStatus, SessionFinancialStatus } from "@/domain/tes";

import { getPatientEncounterActionPolicy } from "./patient-encounter-actions";

const policy = {
  freeUntilHours: 24,
  lateCancelFeePercent: 50,
  noShowFeePercent: 100,
};

const now = new Date("2026-08-01T12:00:00.000Z");

describe("getPatientEncounterActionPolicy", () => {
  it("allows cancelling and rescheduling a paid future encounter", () => {
    const result = getPatientEncounterActionPolicy({
      bookingStatus: BookingStatus.Confirmed,
      cancellationPolicy: policy,
      endsAt: "2026-08-03T13:00:00.000Z",
      financialStatus: SessionFinancialStatus.Paid,
      now,
      startsAt: "2026-08-03T12:00:00.000Z",
    });

    expect(result.cancellation.allowed).toBe(true);
    expect(result.reschedule.allowed).toBe(true);
    expect(result.cancellation.impactLabel).toContain("reembolso integral");
  });

  it("blocks encounter management while payment is not confirmed", () => {
    const result = getPatientEncounterActionPolicy({
      bookingStatus: BookingStatus.PendingPayment,
      cancellationPolicy: policy,
      endsAt: "2026-08-03T13:00:00.000Z",
      financialStatus: SessionFinancialStatus.Processing,
      now,
      startsAt: "2026-08-03T12:00:00.000Z",
    });

    expect(result.cancellation.allowed).toBe(false);
    expect(result.cancellation.disabledReason).toContain("cobrança confirmada");
    expect(result.reschedule.allowed).toBe(false);
    expect(result.reschedule.disabledReason).toContain("pagamento");
  });

  it("explains late cancellation impact before the backend confirms it", () => {
    const result = getPatientEncounterActionPolicy({
      bookingStatus: BookingStatus.Confirmed,
      cancellationPolicy: policy,
      endsAt: "2026-08-01T19:00:00.000Z",
      financialStatus: SessionFinancialStatus.Paid,
      now,
      startsAt: "2026-08-01T18:00:00.000Z",
    });

    expect(result.cancellation.allowed).toBe(true);
    expect(result.cancellation.impactLabel).toContain("50%");
  });

  it("surfaces manual refund review after a cancellation decision", () => {
    const result = getPatientEncounterActionPolicy({
      bookingStatus: BookingStatus.CancelledByPatient,
      cancellationDecision: {
        decision: "manual_review",
        refundAmountCents: 0,
        requiresManualReview: true,
        reviewDueAt: "2026-08-04T12:00:00.000Z",
      },
      cancellationPolicy: policy,
      endsAt: "2026-08-01T19:00:00.000Z",
      financialStatus: SessionFinancialStatus.Paid,
      now,
      startsAt: "2026-08-01T18:00:00.000Z",
    });

    expect(result.cancellation.allowed).toBe(false);
    expect(result.cancellation.refundState).toBe("manual_review");
    expect(result.cancellation.title).toBe("Reembolso em análise");
    expect(result.cancellation.impactLabel).toContain("análise manual");
  });

  it("allows rating only after a paid completed encounter has ended", () => {
    const result = getPatientEncounterActionPolicy({
      bookingStatus: BookingStatus.Completed,
      cancellationPolicy: policy,
      endsAt: "2026-08-01T11:00:00.000Z",
      financialStatus: SessionFinancialStatus.Paid,
      now,
      startsAt: "2026-08-01T10:00:00.000Z",
    });

    expect(result.rating.allowed).toBe(true);
  });
});
