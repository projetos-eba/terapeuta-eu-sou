import { afterEach, describe, expect, it, vi } from "vitest";

import { canJoinBooking } from "./booking-status";

describe("canJoinBooking", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the patient join window exactly at T-15", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T13:45:00.000Z"));

    expect(
      canJoinBooking({
        endsAt: "2026-08-01T15:00:00.000Z",
        paymentStatus: "paid",
        startsAt: "2026-08-01T14:00:00.000Z",
        status: "confirmed",
      }),
    ).toBe(true);
  });

  it("keeps the patient join window open at T-10", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T13:50:00.000Z"));

    expect(
      canJoinBooking({
        endsAt: "2026-08-01T15:00:00.000Z",
        paymentStatus: "paid",
        startsAt: "2026-08-01T14:00:00.000Z",
        status: "confirmed",
      }),
    ).toBe(true);
  });
});
