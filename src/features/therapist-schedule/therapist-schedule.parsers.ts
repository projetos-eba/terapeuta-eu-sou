import type {
  SaveTherapistScheduleInput,
  SaveTherapistScheduleResult,
  TherapistScheduleReadModel,
  TherapistScheduleRule,
  TherapistScheduleService,
  TherapistServiceScheduleSettings,
} from "@/domain/tes";

import { TherapistScheduleContractError } from "./therapist-schedule.errors";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clockPattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export function parseTherapistScheduleReadModel(
  value: unknown,
): TherapistScheduleReadModel {
  const row = requiredRecord(value);
  const summary = requiredRecord(row.summary);

  if (row.contractVersion !== 1) fail();

  return {
    contractVersion: 1,
    rules: requiredArray(row.rules).map(parseRule),
    scheduleVersion: positiveInteger(row.scheduleVersion),
    services: requiredArray(row.services).map(parseService),
    summary: {
      configuredDays: nonNegativeInteger(summary.configuredDays),
      weeklyAvailableMinutes: nonNegativeInteger(
        summary.weeklyAvailableMinutes,
      ),
    },
    therapistProfileId: requiredUuid(row.therapistProfileId),
    timezone: requiredString(row.timezone),
    updatedAt: requiredIsoDateTime(row.updatedAt),
  };
}

export function parseSaveTherapistScheduleInput(
  value: unknown,
): SaveTherapistScheduleInput {
  const row = requiredRecord(value);
  const rules = requiredArray(row.rules);
  const serviceSettings = requiredArray(row.serviceSettings);

  if (rules.length > 100 || serviceSettings.length > 50) fail();

  const parsedRules = rules.map((item) => {
    const rule = requiredRecord(item);
    const id = rule.id === null ? null : requiredUuid(rule.id);
    const dayOfWeek = nonNegativeInteger(rule.dayOfWeek);
    const startTime = requiredClock(rule.startTime);
    const endTime = requiredClock(rule.endTime);

    if (dayOfWeek > 6 || startTime >= endTime) fail();

    return {
      dayOfWeek,
      endTime,
      id,
      isActive: requiredBoolean(rule.isActive),
      serviceId: requiredUuid(rule.serviceId),
      startTime,
    };
  });
  const parsedSettings = serviceSettings.map((item) => {
    const setting = requiredRecord(item);

    return {
      bookingHorizonDays: positiveInteger(setting.bookingHorizonDays),
      bufferAfterMinutes: nonNegativeInteger(setting.bufferAfterMinutes),
      bufferBeforeMinutes: nonNegativeInteger(setting.bufferBeforeMinutes),
      minimumNoticeMinutes: nonNegativeInteger(setting.minimumNoticeMinutes),
      serviceId: requiredUuid(setting.serviceId),
      slotStepMinutes: positiveInteger(setting.slotStepMinutes),
    };
  });

  assertUnique(parsedRules.flatMap((rule) => (rule.id ? [rule.id] : [])));
  assertUnique(parsedSettings.map((setting) => setting.serviceId));

  return {
    expectedVersion: positiveInteger(row.expectedVersion),
    requestId: requiredUuid(row.requestId),
    rules: parsedRules,
    serviceSettings: parsedSettings,
    timezone: requiredString(row.timezone),
  };
}

export function parseSaveTherapistScheduleResult(
  value: unknown,
): SaveTherapistScheduleResult {
  const row = requiredRecord(value);

  return {
    idempotentReplay: requiredBoolean(row.idempotentReplay),
    scheduleVersion: positiveInteger(row.scheduleVersion),
    timezone: requiredString(row.timezone),
  };
}

function parseRule(value: unknown): TherapistScheduleRule {
  const row = requiredRecord(value);
  const dayOfWeek = nonNegativeInteger(row.dayOfWeek);
  const startTime = requiredClock(row.startTime);
  const endTime = requiredClock(row.endTime);

  if (dayOfWeek > 6 || startTime >= endTime) fail();

  return {
    dayOfWeek,
    endTime,
    id: requiredUuid(row.id),
    isActive: requiredBoolean(row.isActive),
    serviceId: requiredUuid(row.serviceId),
    startTime,
  };
}

function parseService(value: unknown): TherapistScheduleService {
  const row = requiredRecord(value);

  return {
    durationMinutes: positiveInteger(row.durationMinutes),
    id: requiredUuid(row.id),
    settings: parseServiceSettings(row.settings),
    status: requiredServiceStatus(row.status),
    title: requiredString(row.title),
    weeklyAvailableMinutes: nonNegativeInteger(row.weeklyAvailableMinutes),
  };
}

function parseServiceSettings(
  value: unknown,
): TherapistServiceScheduleSettings {
  const row = requiredRecord(value);

  return {
    bookingHorizonDays: positiveInteger(row.bookingHorizonDays),
    bufferAfterMinutes: nonNegativeInteger(row.bufferAfterMinutes),
    bufferBeforeMinutes: nonNegativeInteger(row.bufferBeforeMinutes),
    minimumNoticeMinutes: nonNegativeInteger(row.minimumNoticeMinutes),
    slotStepMinutes: positiveInteger(row.slotStepMinutes),
  };
}

function requiredRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) fail();
  return value;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) fail();
  return value;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function requiredUuid(value: unknown): string {
  const result = requiredString(value);
  if (!uuidPattern.test(result)) fail();
  return result;
}

function requiredClock(value: unknown): string {
  const result = requiredString(value);
  if (!clockPattern.test(result)) fail();
  return result;
}

function requiredIsoDateTime(value: unknown): string {
  const result = requiredString(value);
  if (!Number.isFinite(Date.parse(result))) fail();
  return result;
}

function positiveInteger(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) fail();
  return Number(value);
}

function nonNegativeInteger(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) fail();
  return Number(value);
}

function requiredServiceStatus(
  value: unknown,
): TherapistScheduleService["status"] {
  if (
    value !== "active" &&
    value !== "archived" &&
    value !== "draft" &&
    value !== "paused"
  ) {
    fail();
  }

  return value;
}

function assertUnique(values: string[]) {
  if (new Set(values).size !== values.length) fail();
}

function fail(): never {
  throw new TherapistScheduleContractError();
}
