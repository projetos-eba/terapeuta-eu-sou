import { describe, expect, it } from "vitest";

import {
  calculateCommissionSnapshot,
  evaluateSessionTransferEligibility,
} from ".";

describe("payment money rules", () => {
  it("calculates a 20 percent platform commission and keeps 80 percent for the therapist", () => {
    expect(calculateCommissionSnapshot({ grossAmountCents: 20_000 })).toEqual({
      currency: "BRL",
      grossAmountCents: 20_000,
      platformCommissionBps: 2_000,
      platformGrossCommissionCents: 4_000,
      therapistAmountCents: 16_000,
    });
  });

  it("rounds the therapist amount down and leaves the remainder as platform commission", () => {
    expect(
      calculateCommissionSnapshot({
        grossAmountCents: 10_001,
        platformCommissionBps: 2_000,
      }),
    ).toMatchObject({
      platformGrossCommissionCents: 2_001,
      therapistAmountCents: 8_000,
    });
  });
});

describe("session transfer eligibility", () => {
  const confirmedAt = new Date("2026-08-11T12:00:00.000Z");

  it("waits seven days after service confirmation", () => {
    expect(
      evaluateSessionTransferEligibility({
        connectTransfersActive: true,
        financialStatus: "paid",
        now: new Date("2026-08-17T12:00:00.000Z"),
        serviceConfirmedAt: confirmedAt,
        serviceStatus: "confirmed_by_patient_review",
        therapistAmountCents: 16_000,
      }),
    ).toMatchObject({
      eligibleAt: new Date("2026-08-18T12:00:00.000Z"),
      reason: "waiting_safety_period",
      status: "waiting_safety_period",
    });
  });

  it("marks paid and confirmed sessions as eligible after the safety period", () => {
    expect(
      evaluateSessionTransferEligibility({
        connectTransfersActive: true,
        financialStatus: "paid",
        now: new Date("2026-08-18T12:00:00.000Z"),
        serviceConfirmedAt: confirmedAt,
        serviceStatus: "confirmed_by_patient_review",
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
