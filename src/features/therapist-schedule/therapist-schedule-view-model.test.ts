import { describe, expect, it } from "vitest";

import type {
  TherapistScheduleRule,
  TherapistScheduleService,
} from "@/domain/tes";
import type { TherapistAgendaReadModel } from "@/features/bookings";

import {
  buildUpcomingExceptions,
  calculateWeeklyAvailability,
  findDefaultScheduleScope,
  formatDuration,
  getRulesForScope,
  hasOverlappingAvailabilityRules,
} from "./therapist-schedule-view-model";

const serviceId = "d1000000-0000-4000-8000-000000000001";
const secondServiceId = "d1000000-0000-4000-8000-000000000002";

describe("therapist schedule view model", () => {
  it("keeps availability isolated by therapy", () => {
    const otherServiceRule = ruleFixture({
      id: "a1000000-0000-4000-8000-000000000001",
      serviceId: secondServiceId,
    });
    const serviceRule = ruleFixture({
      dayOfWeek: 3,
      id: "a1000000-0000-4000-8000-000000000002",
      serviceId,
    });
    const rules = [otherServiceRule, serviceRule];

    expect(getRulesForScope(rules, serviceId)).toEqual([serviceRule]);
  });

  it("calculates weekly minutes and configured days from active applicable rules", () => {
    const summary = calculateWeeklyAvailability(
      [
        ruleFixture({
          dayOfWeek: 1,
          endTime: "12:00",
          serviceId,
          startTime: "09:00",
        }),
        ruleFixture({
          dayOfWeek: 3,
          endTime: "18:00",
          serviceId,
          startTime: "14:00",
        }),
        ruleFixture({
          dayOfWeek: 5,
          endTime: "17:00",
          isActive: false,
          serviceId,
          startTime: "15:00",
        }),
        ruleFixture({
          dayOfWeek: 6,
          endTime: "13:00",
          serviceId: secondServiceId,
          startTime: "10:00",
        }),
      ],
      serviceId,
    );

    expect(summary).toEqual({
      configuredDays: 2,
      unconfiguredDays: 5,
      weeklyAvailableMinutes: 420,
    });
  });

  it("selects the first service that already has a specific rule", () => {
    const services = [
      serviceFixture(secondServiceId, "Segunda terapia"),
      serviceFixture(serviceId, "Primeira terapia"),
    ];

    expect(
      findDefaultScheduleScope(services, [ruleFixture({ serviceId })]),
    ).toBe(serviceId);
  });

  it("returns an empty scope when no therapy exists", () => {
    expect(findDefaultScheduleScope([], [])).toBe("");
  });

  it("formats duration without displaying invented decimal hours", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(150)).toBe("2h 30min");
  });

  it("formats upcoming exception dates numerically", () => {
    const exceptions = buildUpcomingExceptions({
      agenda: agendaFixture(),
      referenceNow: "2026-08-15T12:00:00.000Z",
      scope: serviceId,
      timezone: "America/Sao_Paulo",
    });

    expect(exceptions).toEqual([
      expect.objectContaining({ dateLabel: "16/08" }),
    ]);
  });

  it("detects overlapping active ranges in the same effective availability", () => {
    expect(
      hasOverlappingAvailabilityRules([
        ruleFixture({ endTime: "18:00", startTime: "08:00" }),
        ruleFixture({
          endTime: "19:00",
          id: "a1000000-0000-4000-8000-000000000004",
          startTime: "07:00",
        }),
      ]),
    ).toBe(true);

    expect(
      hasOverlappingAvailabilityRules([
        ruleFixture({ endTime: "12:00", startTime: "09:00" }),
        ruleFixture({
          endTime: "15:00",
          id: "a1000000-0000-4000-8000-000000000006",
          startTime: "12:00",
        }),
        ruleFixture({
          endTime: "12:00",
          id: "a1000000-0000-4000-8000-000000000007",
          serviceId: secondServiceId,
          startTime: "09:00",
        }),
      ]),
    ).toBe(false);
  });
});

function ruleFixture(
  overrides: Partial<TherapistScheduleRule> = {},
): TherapistScheduleRule {
  return {
    dayOfWeek: 1,
    endTime: "11:00",
    id: "a1000000-0000-4000-8000-000000000003",
    isActive: true,
    serviceId,
    startTime: "09:00",
    ...overrides,
  };
}

function serviceFixture(id: string, title: string): TherapistScheduleService {
  return {
    durationMinutes: 60,
    id,
    settings: {
      bookingHorizonDays: 60,
      bufferAfterMinutes: 15,
      bufferBeforeMinutes: 15,
      minimumNoticeMinutes: 1440,
      slotStepMinutes: 30,
    },
    status: "active",
    title,
    weeklyAvailableMinutes: 0,
  };
}

function agendaFixture(): TherapistAgendaReadModel {
  return {
    availability: {
      exceptions: [
        {
          endsAt: "2026-08-16T14:00:00.000Z",
          id: "f1000000-0000-4000-8000-000000000001",
          isAvailable: false,
          serviceId: null,
          startsAt: "2026-08-16T12:00:00.000Z",
        },
      ],
      rules: [],
    },
    bookings: [],
    holds: [],
    range: {
      end: "2026-08-30T00:00:00.000Z",
      endExclusive: true,
      start: "2026-08-15T00:00:00.000Z",
    },
    summary: {
      activeHolds: 0,
      bookings: 0,
      pendingReschedules: 0,
    },
    therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    timezone: "America/Sao_Paulo",
    version: 1,
  };
}
