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

  it("allows first entry through T+15 inclusive and blocks one millisecond later", () => {
    const input = {
      endsAt: "2026-08-01T15:00:00.000Z",
      patientHasJoined: false,
      paymentStatus: "paid",
      startsAt: "2026-08-01T14:00:00.000Z",
      status: "confirmed",
    };

    expect(
      canJoinBooking({
        ...input,
        now: new Date("2026-08-01T14:15:00.000Z"),
      }),
    ).toBe(true);
    expect(
      canJoinBooking({
        ...input,
        now: new Date("2026-08-01T14:15:00.001Z"),
      }),
    ).toBe(false);
  });

  it("allows a trusted patient to reconnect until but not at the scheduled end", () => {
    const input = {
      endsAt: "2026-08-01T15:00:00.000Z",
      patientHasJoined: true,
      paymentStatus: "paid",
      startsAt: "2026-08-01T14:00:00.000Z",
      status: "confirmed",
    };

    expect(
      canJoinBooking({
        ...input,
        now: new Date("2026-08-01T14:59:59.999Z"),
      }),
    ).toBe(true);
    expect(
      canJoinBooking({
        ...input,
        now: new Date("2026-08-01T15:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
