import {
  TherapistBlockReason,
  TherapistBlockRecurrence,
  type CreateTherapistBlockInput,
  type TherapistBlockActionInput,
  type TherapistBlockCommandResult,
  type TherapistBlocksReadModel,
  type TherapistPaidBlockConflict,
} from "@/domain/tes";

import { TherapistBlocksContractError } from "./therapist-blocks.errors";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const reasons = new Set(Object.values(TherapistBlockReason));
const recurrences = new Set(Object.values(TherapistBlockRecurrence));

export function parseTherapistBlocksReadModel(
  value: unknown,
): TherapistBlocksReadModel {
  const data = object(value);
  const summary = object(data.summary);
  const blocks = array(data.blocks).map((item) => {
    const block = object(item);
    const impacts = array(block.impactedBookings).map((impactValue) => {
      const impact = object(impactValue);
      return {
        bookingId: uuid(impact.bookingId),
        impactId: uuid(impact.impactId),
        patientName: text(impact.patientName),
        resolution:
          impact.resolution === null
            ? null
            : literal(impact.resolution, ["keep_booking"] as const),
        serviceTitle: text(impact.serviceTitle),
        startsAt: dateTime(impact.startsAt),
        status: literal(impact.status, [
          "dismissed",
          "pending",
          "resolved",
        ] as const),
      };
    });

    return {
      allDay: boolean(block.allDay),
      createdAt: dateTime(block.createdAt),
      endsAt: dateTime(block.endsAt),
      id: uuid(block.id),
      impactedBookings: impacts,
      reason: nullableText(block.reason),
      reasonCode: reason(block.reasonCode),
      recurrenceEndsOn:
        block.recurrenceEndsOn === null
          ? null
          : dateOnly(block.recurrenceEndsOn),
      recurrenceFrequency: recurrence(block.recurrenceFrequency),
      seriesId: nullableUuid(block.seriesId),
      serviceId: nullableUuid(block.serviceId),
      serviceTitle: nullableText(block.serviceTitle),
      startsAt: dateTime(block.startsAt),
      status: literal(block.status, ["active", "cancelled"] as const),
      timezone: text(block.timezone),
      version: positiveInteger(block.version),
    };
  });

  const cursor =
    data.nextCursor === null
      ? null
      : {
          id: uuid(object(data.nextCursor).id),
          startsAt: dateTime(object(data.nextCursor).startsAt),
        };

  return {
    blocks,
    contractVersion: literal(data.contractVersion, [1] as const),
    nextCursor: cursor,
    scheduleVersion: positiveInteger(data.scheduleVersion),
    summary: {
      activeBlocks: nonNegativeInteger(summary.activeBlocks),
      pendingImpacts: nonNegativeInteger(summary.pendingImpacts),
      recurringSeries: nonNegativeInteger(summary.recurringSeries),
    },
    therapistProfileId: uuid(data.therapistProfileId),
    timezone: text(data.timezone),
  };
}

export function parseCreateTherapistBlockInput(
  value: unknown,
): CreateTherapistBlockInput {
  const data = object(value);
  if (data.action !== "create") throw new TherapistBlocksContractError();
  const allDay = boolean(data.allDay);
  const startsOn = dateOnly(data.startsOn);
  const recurrenceEndsOn = dateOnly(data.recurrenceEndsOn);
  const recurrenceFrequency = recurrence(data.recurrenceFrequency);
  const startTime = data.startTime === null ? null : clock(data.startTime);
  const endTime = data.endTime === null ? null : clock(data.endTime);
  const blockReason = nullableText(data.reason);

  if (
    recurrenceEndsOn < startsOn ||
    (recurrenceFrequency === TherapistBlockRecurrence.None &&
      recurrenceEndsOn !== startsOn) ||
    (!allDay && (!startTime || !endTime || startTime >= endTime)) ||
    (allDay && (startTime !== null || endTime !== null)) ||
    (blockReason?.length ?? 0) > 240
  ) {
    throw new TherapistBlocksContractError();
  }

  return {
    action: "create",
    allDay,
    endTime,
    reason: blockReason,
    reasonCode: reason(data.reasonCode),
    recurrenceEndsOn,
    recurrenceFrequency,
    requestId: uuid(data.requestId),
    serviceId: nullableUuid(data.serviceId),
    startTime,
    startsOn,
    timezone: boundedText(data.timezone, 100),
  };
}

export function parseTherapistBlockActionInput(
  value: unknown,
): TherapistBlockActionInput {
  const data = object(value);

  if (data.action === "create") {
    return parseCreateTherapistBlockInput(data);
  }

  if (data.action === "cancel") {
    return {
      action: "cancel",
      blockId: uuid(data.blockId),
      expectedScheduleVersion: positiveInteger(data.expectedScheduleVersion),
      requestId: uuid(data.requestId),
      scope: literal(data.scope, ["occurrence", "series"] as const),
    };
  }

  if (data.action === "resolve_impact") {
    return {
      action: "resolve_impact",
      impactId: uuid(data.impactId),
      requestId: uuid(data.requestId),
      resolution: literal(data.resolution, ["keep_booking"] as const),
    };
  }

  throw new TherapistBlocksContractError();
}

export function parseTherapistBlockCommandResult(
  value: unknown,
): TherapistBlockCommandResult {
  const data = object(value);
  return {
    idempotentReplay: boolean(data.idempotentReplay),
    impactedBookingCount: optionalNonNegativeInteger(data.impactedBookingCount),
    occurrenceCount: optionalNonNegativeInteger(data.occurrenceCount),
    paidImpactedBookings:
      data.paidImpactedBookings === undefined
        ? undefined
        : array(data.paidImpactedBookings).map(parsePaidBlockConflict),
    scheduleVersion: optionalPositiveInteger(data.scheduleVersion),
    seriesId: data.seriesId === undefined ? undefined : uuid(data.seriesId),
  };
}

function parsePaidBlockConflict(value: unknown): TherapistPaidBlockConflict {
  const data = object(value);
  return {
    bookingId: uuid(data.bookingId),
    endsAt: dateTime(data.endsAt),
    patientName: text(data.patientName),
    serviceTitle: text(data.serviceTitle),
    startsAt: dateTime(data.startsAt),
    timezone: boundedText(data.timezone, 100),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) fail();
  return value;
}

function text(value: unknown) {
  if (typeof value !== "string" || value.length === 0) fail();
  return value;
}

function boundedText(value: unknown, max: number) {
  const parsed = text(value);
  if (parsed.length > max) fail();
  return parsed;
}

function nullableText(value: unknown) {
  if (value === null) return null;
  return text(value);
}

function uuid(value: unknown) {
  const parsed = text(value);
  if (!UUID.test(parsed)) fail();
  return parsed;
}

function nullableUuid(value: unknown) {
  if (value === null) return null;
  return uuid(value);
}

function dateOnly(value: unknown) {
  const parsed = text(value);
  if (!DATE.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) {
    fail();
  }
  return parsed;
}

function clock(value: unknown) {
  const parsed = text(value);
  if (!TIME.test(parsed)) fail();
  return parsed;
}

function dateTime(value: unknown) {
  const parsed = text(value);
  if (!ISO_DATE_TIME.test(parsed) || Number.isNaN(Date.parse(parsed))) fail();
  return parsed;
}

function boolean(value: unknown) {
  if (typeof value !== "boolean") fail();
  return value;
}

function reason(value: unknown) {
  if (typeof value !== "string" || !reasons.has(value as never)) fail();
  return value as TherapistBlockReason;
}

function recurrence(value: unknown) {
  if (typeof value !== "string" || !recurrences.has(value as never)) fail();
  return value as TherapistBlockRecurrence;
}

function literal<const T extends readonly (number | string)[]>(
  value: unknown,
  allowed: T,
): T[number] {
  if (!allowed.includes(value as never)) fail();
  return value as T[number];
}

function positiveInteger(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1) fail();
  return Number(value);
}

function nonNegativeInteger(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0) fail();
  return Number(value);
}

function optionalPositiveInteger(value: unknown) {
  return value === undefined ? undefined : positiveInteger(value);
}

function optionalNonNegativeInteger(value: unknown) {
  return value === undefined ? undefined : nonNegativeInteger(value);
}

function fail(): never {
  throw new TherapistBlocksContractError();
}
