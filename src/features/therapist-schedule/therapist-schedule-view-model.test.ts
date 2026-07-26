import { describe, expect, it } from "vitest";

import type {
  TherapistScheduleRule,
  TherapistScheduleService,
} from "@/domain/tes";

import {
  calculateWeeklyAvailability,
  findDefaultScheduleScope,
  formatDuration,
  getApplicableRules,
  getRulesForScope,
} from "./therapist-schedule-view-model";

const serviceId = "d1000000-0000-4000-8000-000000000001";
const secondServiceId = "d1000000-0000-4000-8000-000000000002";

describe("therapist schedule view model", () => {
  it("separates editable scope from inherited general rules", () => {
    const generalRule = ruleFixture({
      id: "a1000000-0000-4000-8000-000000000001",
      serviceId: null,
    });
    const serviceRule = ruleFixture({
      dayOfWeek: 3,
      id: "a1000000-0000-4000-8000-000000000002",
      serviceId,
    });
    const rules = [generalRule, serviceRule];

    expect(getRulesForScope(rules, serviceId)).toEqual([serviceRule]);
    expect(getApplicableRules(rules, serviceId)).toEqual([
      generalRule,
      serviceRule,
    ]);
  });

  it("calculates weekly minutes and configured days from active applicable rules", () => {
    const summary = calculateWeeklyAvailability(
      [
        ruleFixture({
          dayOfWeek: 1,
          endTime: "12:00",
          serviceId: null,
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

  it("falls back to general availability when no service exists", () => {
    expect(findDefaultScheduleScope([], [])).toBe("all");
  });

  it("formats duration without displaying invented decimal hours", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(150)).toBe("2h 30min");
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
