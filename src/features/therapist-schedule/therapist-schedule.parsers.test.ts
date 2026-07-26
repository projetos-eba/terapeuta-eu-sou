import { describe, expect, it } from "vitest";

import {
  parseSaveTherapistScheduleInput,
  parseSaveTherapistScheduleResult,
  parseTherapistScheduleReadModel,
} from "./therapist-schedule.parsers";
import { TherapistScheduleContractError } from "./therapist-schedule.errors";

const therapistProfileId = "c1000000-0000-4000-8000-000000000001";
const serviceId = "d1000000-0000-4000-8000-000000000001";
const ruleId = "e1000000-0000-4000-8000-000000000001";

describe("therapist schedule contracts", () => {
  it("parses the versioned read model without changing service authorities", () => {
    const result = parseTherapistScheduleReadModel(readModelFixture());

    expect(result.contractVersion).toBe(1);
    expect(result.therapistProfileId).toBe(therapistProfileId);
    expect(result.services[0]).toMatchObject({
      durationMinutes: 50,
      id: serviceId,
      settings: {
        bufferAfterMinutes: 15,
        bufferBeforeMinutes: 10,
        slotStepMinutes: 30,
      },
    });
  });

  it("rejects unknown read model versions", () => {
    expect(() =>
      parseTherapistScheduleReadModel({
        ...readModelFixture(),
        contractVersion: 2,
      }),
    ).toThrow(TherapistScheduleContractError);
  });

  it("rejects invalid day and clock ranges", () => {
    const invalidDay = readModelFixture();
    invalidDay.rules[0].dayOfWeek = 7;
    const reversed = readModelFixture();
    reversed.rules[0].startTime = "18:00";
    reversed.rules[0].endTime = "09:00";

    expect(() => parseTherapistScheduleReadModel(invalidDay)).toThrow(
      TherapistScheduleContractError,
    );
    expect(() => parseTherapistScheduleReadModel(reversed)).toThrow(
      TherapistScheduleContractError,
    );
  });

  it("rejects duplicated identifiers in a save command", () => {
    const input = saveInputFixture();
    input.rules.push({ ...input.rules[0] });

    expect(() => parseSaveTherapistScheduleInput(input)).toThrow(
      TherapistScheduleContractError,
    );
  });

  it("parses idempotent command results explicitly", () => {
    expect(
      parseSaveTherapistScheduleResult({
        idempotentReplay: true,
        scheduleVersion: 4,
        timezone: "America/Sao_Paulo",
      }),
    ).toEqual({
      idempotentReplay: true,
      scheduleVersion: 4,
      timezone: "America/Sao_Paulo",
    });
  });
});

function readModelFixture() {
  return {
    contractVersion: 1,
    rules: [
      {
        dayOfWeek: 1,
        endTime: "12:00",
        id: ruleId,
        isActive: true,
        serviceId,
        startTime: "09:00",
      },
    ],
    scheduleVersion: 1,
    services: [
      {
        durationMinutes: 50,
        id: serviceId,
        settings: {
          bookingHorizonDays: 45,
          bufferAfterMinutes: 15,
          bufferBeforeMinutes: 10,
          minimumNoticeMinutes: 180,
          slotStepMinutes: 30,
        },
        status: "active",
        title: "Reiki online",
        weeklyAvailableMinutes: 180,
      },
    ],
    summary: {
      configuredDays: 0,
      weeklyAvailableMinutes: 0,
    },
    therapistProfileId,
    timezone: "America/Sao_Paulo",
    updatedAt: "2026-07-26T12:00:00.000Z",
  };
}

function saveInputFixture() {
  return {
    expectedVersion: 1,
    requestId: "a3000000-0000-4000-8000-000000000001",
    rules: [
      {
        dayOfWeek: 1,
        endTime: "12:00",
        id: ruleId,
        isActive: true,
        serviceId,
        startTime: "09:00",
      },
    ],
    serviceSettings: [
      {
        bookingHorizonDays: 45,
        bufferAfterMinutes: 15,
        bufferBeforeMinutes: 10,
        minimumNoticeMinutes: 180,
        serviceId,
        slotStepMinutes: 30,
      },
    ],
    timezone: "America/Sao_Paulo",
  };
}
