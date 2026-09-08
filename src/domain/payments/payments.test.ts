import { describe, expect, it } from "vitest";

import {
  calculateCommissionSnapshot,
  evaluateSessionTransferEligibility,
} from ".";

describe("payment money rules", () => {
  it("calculates a 15 percent platform commission and keeps 85 percent for the therapist", () => {
    expect(calculateCommissionSnapshot({ grossAmountCents: 20_000 })).toEqual({
      currency: "BRL",
      grossAmountCents: 20_000,
      platformCommissionBps: 1_500,
      platformGrossCommissionCents: 3_000,
      therapistAmountCents: 17_000,
    });
  });

  it("rounds the therapist amount down and leaves the remainder as platform commission", () => {
    expect(
      calculateCommissionSnapshot({
        grossAmountCents: 10_001,
        platformCommissionBps: 1_500,
      }),
    ).toMatchObject({
      platformGrossCommissionCents: 1_501,
      therapistAmountCents: 8_500,
    });
  });
});

describe("session transfer eligibility", () => {
  const confirmedAt = new Date("2026-08-11T12:00:00.000Z");

  it("waits for Stripe settlement after service confirmation", () => {
    expect(
      evaluateSessionTransferEligibility({
        connectTransfersActive: true,
        financialStatus: "paid",
        now: new Date("2026-08-11T12:00:00.000Z"),
        serviceConfirmedAt: confirmedAt,
        serviceStatus: "confirmed_by_patient_review",
        therapistAmountCents: 16_000,
      }),
    ).toMatchObject({
      eligibleAt: confirmedAt,
      reason: "stripe_settlement_pending",
      status: "waiting_settlement",
    });
  });

  it("marks a confirmed session as eligible with recent available settlement evidence", () => {
    expect(
      evaluateSessionTransferEligibility({
        connectTransfersActive: true,
        financialStatus: "paid",
        now: new Date("2026-08-18T12:00:00.000Z"),
        serviceConfirmedAt: confirmedAt,
        serviceStatus: "confirmed_by_patient_review",
        stripeBalanceAvailableOn: new Date("2026-08-18T10:00:00.000Z"),
        stripeBalanceCheckedAt: new Date("2026-08-18T12:00:00.000Z"),
        stripeBalanceStatus: "available",
        stripeBalanceTransactionId: "txn_test",
        stripeChargeId: "ch_test",
        therapistAmountCents: 16_000,
      }),
    ).toMatchObject({
      reason: "eligible",
      status: "eligible",
    });
  });

  it("recognizes the canonical bilateral confirmation state", () => {
    expect(
      evaluateSessionTransferEligibility({
        connectTransfersActive: true,
        financialStatus: "paid",
        now: new Date("2026-08-18T12:00:00.000Z"),
        serviceConfirmedAt: confirmedAt,
        serviceStatus: "confirmed_bilateral",
        stripeBalanceAvailableOn: new Date("2026-08-18T10:00:00.000Z"),
        stripeBalanceCheckedAt: new Date("2026-08-18T12:00:00.000Z"),
        stripeBalanceStatus: "available",
        stripeBalanceTransactionId: "txn_test",
        stripeChargeId: "ch_test",
        therapistAmountCents: 16_000,
      }),
    ).toMatchObject({
      reason: "eligible",
      status: "eligible",
    });
  });

  it("blocks disputed payments", () => {
    expect(
      evaluateSessionTransferEligibility({
        connectTransfersActive: true,
        financialStatus: "disputed",
        now: new Date("2026-08-20T12:00:00.000Z"),
        serviceConfirmedAt: confirmedAt,
        serviceStatus: "confirmed_by_therapist",
        therapistAmountCents: 16_000,
      }),
    ).toMatchObject({
      reason: "disputed",
      status: "blocked",
    });
  });
});
