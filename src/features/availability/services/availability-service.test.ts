import { describe, expect, it } from "vitest";

import { DomainErrorCode, TesDomainError } from "@/domain/tes";

import {
  buildAvailabilityDays,
  type AvailabilityServiceInput,
} from "./availability-service";

describe("buildAvailabilityDays", () => {
  it("blocks therapist bookings across services and applies buffers", () => {
    const result = buildAvailabilityDays(
      input({
        bookings: [
          {
            endsAt: localIso(2026, 7, 27, 11, 0),
            serviceId: "another-service",
            startsAt: localIso(2026, 7, 27, 10, 0),
            status: "confirmed",
          },
        ],
      }),
    );

    const labels = result[0]?.slots.map((slot) => slot.timeLabel);
    expect(labels).not.toContain("10:00");
    expect(labels).toContain("11:30");
  });

  it("anchors the first session start to the availability window", () => {
    const result = buildAvailabilityDays(input());

    expect(result[0]?.slots[0]?.timeLabel).toBe("09:00");
  });

  it("uses available exceptions when no weekly rule exists", () => {
    const result = buildAvailabilityDays(
      input({
        exceptions: [
          {
            endsAt: localIso(2026, 7, 27, 12, 0),
            isAvailable: true,
            serviceId: null,
            startsAt: localIso(2026, 7, 27, 9, 0),
          },
        ],
        rules: [],
      }),
    );

    expect(result[0]?.slots.length).toBeGreaterThan(0);
  });

  it("returns an empty period without inventing slots", () => {
    expect(buildAvailabilityDays(input({ rules: [] }))).toEqual([]);
  });

  it("rejects invalid ranges", () => {
    expect(() =>
      buildAvailabilityDays(
        input({
          rules: [
            {
              dayOfWeek: 1,
              endTime: "09:00",
              isActive: true,
              serviceId: "service-1",
              startTime: "10:00",
              timezone: "America/Sao_Paulo",
            },
          ],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: DomainErrorCode.InvalidAvailabilityRange,
      }),
    );
  });

  it("rejects overlapping active rules", () => {
    try {
      buildAvailabilityDays(
        input({
          rules: [weeklyRule("09:00", "12:00"), weeklyRule("11:00", "13:00")],
        }),
      );
      throw new Error("Expected overlap validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(TesDomainError);
      expect((error as TesDomainError).code).toBe(
        DomainErrorCode.OverlappingAvailabilityRule,
      );
    }
  });
});

function input(
  overrides: Partial<AvailabilityServiceInput> = {},
): AvailabilityServiceInput {
  return {
    bookings: [],
    exceptions: [],
    now: new Date(2026, 6, 27, 8, 0, 0),
    rules: [weeklyRule("09:00", "13:00")],
    selectedServiceId: "service-1",
    serviceDurationMinutes: 60,
    settings: {
      bufferAfterMinutes: 10,
      bufferBeforeMinutes: 10,
      intervalMinutes: 30,
      maxDaysAhead: 1,
      minNoticeMinutes: 0,
      serviceId: "service-1",
    },
    ...overrides,
  };
}

function weeklyRule(
  startTime: string,
  endTime: string,
): AvailabilityServiceInput["rules"][number] {
  return {
    dayOfWeek: 1,
    endTime,
    isActive: true,
    serviceId: "service-1",
    startTime,
    timezone: "America/Sao_Paulo",
  };
}

function localIso(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
) {
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00-03:00`,
  ).toISOString();
}
