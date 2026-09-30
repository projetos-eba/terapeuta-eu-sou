import { afterEach, describe, expect, it, vi } from "vitest";

import type { ZoomAccessState } from "@/domain/tes";

import {
  getTherapistDirectRoomEntryAtMs,
  getZoomServerClockOffsetMs,
  shouldConfirmTherapistEarlyRoomEntry,
} from "./zoom-access-time";

const scheduledStartsAt = "2026-09-30T14:30:00.000Z";
const availableFrom = "2026-09-30T14:15:00.000Z";

function accessFixture(
  overrides: Partial<ZoomAccessState> = {},
): ZoomAccessState {
  return {
    allowed: true,
    availableFrom,
    availableUntil: "2026-09-30T15:30:00.000Z",
    reason: null,
    scheduledStartsAt,
    serverNow: "2026-09-30T14:15:00.000Z",
    videoSessionStatus: "ready",
    ...overrides,
  };
}

describe("therapist early room entry timing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["before T−15", "2026-09-30T14:14:59.999Z", false],
    ["at T−15", "2026-09-30T14:15:00.000Z", true],
    ["at 14:28:59", "2026-09-30T14:28:59.999Z", true],
    ["at 14:29", "2026-09-30T14:29:00.000Z", false],
    ["at the scheduled start", "2026-09-30T14:30:00.000Z", false],
  ])("requires confirmation %s", (_label, now, expected) => {
    expect(
      shouldConfirmTherapistEarlyRoomEntry({
        access: accessFixture(),
        serverNowMs: Date.parse(now),
      }),
    ).toBe(expected);
  });

  it("waits for a later authoritative room opening and fails closed without an eligible room", () => {
    expect(
      shouldConfirmTherapistEarlyRoomEntry({
        access: accessFixture({ availableFrom: "2026-09-30T14:17:00.000Z" }),
        serverNowMs: Date.parse("2026-09-30T14:16:59.999Z"),
      }),
    ).toBe(false);
    expect(
      shouldConfirmTherapistEarlyRoomEntry({
        access: accessFixture({ allowed: false }),
        serverNowMs: Date.parse("2026-09-30T14:20:00.000Z"),
      }),
    ).toBe(false);
  });

  it("uses the read model server clock and schedules direct entry one minute before", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T14:10:00.000Z"));

    expect(
      getZoomServerClockOffsetMs(
        accessFixture({ serverNow: "2026-09-30T14:15:00.000Z" }),
      ),
    ).toBe(5 * 60_000);
    expect(getTherapistDirectRoomEntryAtMs(accessFixture())).toBe(
      Date.parse("2026-09-30T14:29:00.000Z"),
    );
  });
});
