import { describe, expect, it } from "vitest";

import { SessionFinancialStatus } from "@/domain/tes";

import { getTherapistSessionChangePolicy } from "./therapist-session-change-policy";

const now = new Date("2026-09-17T12:00:00.000Z");

function resolvePolicy(
  input: Partial<Parameters<typeof getTherapistSessionChangePolicy>[0]> = {},
) {
  return getTherapistSessionChangePolicy({
    canCancelByLifecycle: true,
    canRescheduleByLifecycle: true,
    financialStatus: SessionFinancialStatus.Pending,
    now,
    startsAt: "2026-09-20T12:00:01.000Z",
    ...input,
  });
}

describe("getTherapistSessionChangePolicy", () => {
  it("allows a pristine session more than 48 hours away", () => {
    expect(resolvePolicy()).toEqual({
      canCancel: true,
      canReschedule: true,
      cancelDisabledReason: null,
      rescheduleDisabledReason: null,
    });
  });

  it("allows only cancellation from 24 through 48 hours", () => {
    const policy = resolvePolicy({ startsAt: "2026-09-19T00:00:00.000Z" });

    expect(policy.canCancel).toBe(true);
    expect(policy.canReschedule).toBe(false);
    expect(policy.rescheduleDisabledReason).toContain("mais de 48 horas");
  });

  it("blocks both actions at the 24-hour boundary", () => {
    const policy = resolvePolicy({ startsAt: "2026-09-18T12:00:00.000Z" });

    expect(policy.canCancel).toBe(false);
    expect(policy.canReschedule).toBe(false);
    expect(policy.cancelDisabledReason).toContain("menos de 24 horas");
  });

  it("fails closed after payment activity", () => {
    const policy = resolvePolicy({
      financialStatus: SessionFinancialStatus.Paid,
    });

    expect(policy.canCancel).toBe(false);
    expect(policy.canReschedule).toBe(false);
    expect(policy.cancelDisabledReason).toContain("já foi iniciada");
  });

  it("keeps an unavailable lifecycle action unavailable", () => {
    const policy = resolvePolicy({
      canCancelByLifecycle: false,
      canRescheduleByLifecycle: false,
    });

    expect(policy).toMatchObject({ canCancel: false, canReschedule: false });
  });
});
