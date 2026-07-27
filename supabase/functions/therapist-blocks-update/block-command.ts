import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const reasons = new Set([
  "administrative",
  "health",
  "other",
  "personal",
  "training",
  "vacation",
]);

export type BlockCommandBody =
  | {
    action?: "cancel";
    blockId?: string;
    expectedScheduleVersion?: number;
    requestId?: string;
    scope?: "occurrence" | "series";
  }
  | {
    action?: "create";
    allDay?: boolean;
    endTime?: string | null;
    reason?: string | null;
    reasonCode?: string;
    recurrenceEndsOn?: string;
    recurrenceFrequency?: "daily" | "none" | "weekly";
    requestId?: string;
    serviceId?: string | null;
    startTime?: string | null;
    startsOn?: string;
    timezone?: string;
  }
  | {
    action?: "resolve_impact";
    impactId?: string;
    requestId?: string;
    resolution?: "keep_booking";
  };

export type ValidBlockCommand =
  | {
    action: "cancel";
    blockId: string;
    expectedScheduleVersion: number;
    requestId: string;
    scope: "occurrence" | "series";
  }
  | {
    action: "create";
    allDay: boolean;
    endTime: string | null;
    reason: string | null;
    reasonCode: string;
    recurrenceEndsOn: string;
    recurrenceFrequency: "daily" | "none" | "weekly";
    requestId: string;
    serviceId: string | null;
    startTime: string | null;
    startsOn: string;
    timezone: string;
  }
  | {
    action: "resolve_impact";
    impactId: string;
    requestId: string;
    resolution: "keep_booking";
  };

export function validateBlockCommand(
  body: BlockCommandBody,
): ValidBlockCommand {
  if (body.action === "cancel") {
    if (
      !isUuid(body.blockId) ||
      !isUuid(body.requestId) ||
      !Number.isInteger(body.expectedScheduleVersion) ||
      Number(body.expectedScheduleVersion) < 1 ||
      !["occurrence", "series"].includes(body.scope ?? "")
    ) {
      invalid();
    }

    return {
      action: "cancel",
      blockId: body.blockId,
      expectedScheduleVersion: Number(body.expectedScheduleVersion),
      requestId: body.requestId,
      scope: body.scope as "occurrence" | "series",
    };
  }

  if (body.action === "resolve_impact") {
    if (
      !isUuid(body.impactId) ||
      !isUuid(body.requestId) ||
      body.resolution !== "keep_booking"
    ) {
      invalid();
    }

    return {
      action: "resolve_impact",
      impactId: body.impactId,
      requestId: body.requestId,
      resolution: "keep_booking",
    };
  }

  if (body.action !== "create") invalid();

  if (
    !isUuid(body.requestId) ||
    !isDate(body.startsOn) ||
    !isDate(body.recurrenceEndsOn) ||
    body.recurrenceEndsOn < body.startsOn ||
    !["daily", "none", "weekly"].includes(body.recurrenceFrequency ?? "") ||
    (body.recurrenceFrequency === "none" &&
      body.recurrenceEndsOn !== body.startsOn) ||
    typeof body.allDay !== "boolean" ||
    typeof body.timezone !== "string" ||
    body.timezone.length < 1 ||
    body.timezone.length > 100 ||
    !reasons.has(body.reasonCode ?? "") ||
    (body.serviceId !== null && !isUuid(body.serviceId)) ||
    (body.reason !== null &&
      (typeof body.reason !== "string" || body.reason.length > 240))
  ) {
    invalid();
  }

  if (
    (body.allDay && (body.startTime !== null || body.endTime !== null)) ||
    (!body.allDay &&
      (!isTime(body.startTime) ||
        !isTime(body.endTime) ||
        body.startTime >= body.endTime))
  ) {
    invalid();
  }

  return {
    action: "create",
    allDay: body.allDay,
    endTime: body.endTime ?? null,
    reason: body.reason?.trim() || null,
    reasonCode: body.reasonCode as string,
    recurrenceEndsOn: body.recurrenceEndsOn,
    recurrenceFrequency: body.recurrenceFrequency as
      | "daily"
      | "none"
      | "weekly",
    requestId: body.requestId,
    serviceId: body.serviceId ?? null,
    startTime: body.startTime ?? null,
    startsOn: body.startsOn,
    timezone: body.timezone,
  };
}

export function mapBlockDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;
  const details = error.safeDetails ?? "";

  if (details.includes("schedule_version_conflict")) {
    return new DomainError(
      "schedule_version_conflict",
      409,
      "A agenda foi alterada em outra sessao. Atualize e tente novamente.",
    );
  }
  if (
    details.includes("invalid_block") ||
    details.includes("block_recurrence_too_long")
  ) {
    return new DomainError(
      "invalid_block_payload",
      422,
      "Revise os dados do bloqueio.",
    );
  }
  if (
    details.includes("block_service_forbidden") ||
    details.includes("therapist_access")
  ) {
    return new DomainError(
      "block_forbidden",
      403,
      "Voce nao pode alterar este bloqueio.",
    );
  }
  if (details.includes("block_not_found")) {
    return new DomainError(
      "block_not_found",
      404,
      "Este bloqueio nao foi encontrado.",
    );
  }

  return error;
}

function invalid(): never {
  throw new DomainError(
    "invalid_block_payload",
    422,
    "Revise os dados do bloqueio.",
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}
