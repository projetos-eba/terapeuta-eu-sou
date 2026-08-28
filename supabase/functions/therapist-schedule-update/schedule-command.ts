import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

export type ScheduleRule = {
  dayOfWeek: number;
  endTime: string;
  id: string | null;
  isActive: boolean;
  serviceId: string;
  startTime: string;
};

export type ServiceSettings = {
  bookingHorizonDays: number;
  bufferAfterMinutes: number;
  bufferBeforeMinutes: number;
  minimumNoticeMinutes: number;
  serviceId: string;
  slotStepMinutes: number;
};

export type ScheduleCommandBody = {
  expectedVersion?: number;
  requestId?: string;
  rules?: ScheduleRule[];
  serviceSettings?: ServiceSettings[];
  timezone?: string;
};

export type ValidScheduleCommand = {
  expectedVersion: number;
  requestId: string;
  rules: ScheduleRule[];
  serviceSettings: ServiceSettings[];
  timezone: string;
};

export function validateScheduleCommand(
  body: ScheduleCommandBody,
): ValidScheduleCommand {
  if (
    !Number.isInteger(body.expectedVersion) ||
    Number(body.expectedVersion) < 1 ||
    !isUuid(body.requestId) ||
    typeof body.timezone !== "string" ||
    body.timezone.length < 1 ||
    body.timezone.length > 100 ||
    !Array.isArray(body.rules) ||
    !Array.isArray(body.serviceSettings) ||
    body.rules.length > 100 ||
    body.serviceSettings.length > 50
  ) {
    throw new DomainError(
      "invalid_schedule_payload",
      422,
      "Revise os dados dos horarios.",
    );
  }

  const ruleIds = new Set<string>();
  for (const rule of body.rules) {
    if (
      (rule.id !== null && !isUuid(rule.id)) ||
      !isUuid(rule.serviceId) ||
      !Number.isInteger(rule.dayOfWeek) ||
      rule.dayOfWeek < 0 ||
      rule.dayOfWeek > 6 ||
      !isClock(rule.startTime) ||
      !isClock(rule.endTime) ||
      rule.startTime >= rule.endTime ||
      typeof rule.isActive !== "boolean"
    ) {
      throw new DomainError(
        "invalid_availability_range",
        422,
        "Revise as faixas de horario.",
      );
    }

    if (rule.id && ruleIds.has(rule.id)) {
      throw new DomainError(
        "duplicate_schedule_rule",
        422,
        "Uma faixa de horario foi enviada mais de uma vez.",
      );
    }
    if (rule.id) ruleIds.add(rule.id);
  }

  const serviceIds = new Set<string>();
  for (const settings of body.serviceSettings) {
    if (
      !isUuid(settings.serviceId) ||
      !isNonNegativeInteger(settings.bufferBeforeMinutes) ||
      !isNonNegativeInteger(settings.bufferAfterMinutes) ||
      !isNonNegativeInteger(settings.minimumNoticeMinutes) ||
      !isPositiveInteger(settings.bookingHorizonDays) ||
      !isPositiveInteger(settings.slotStepMinutes)
    ) {
      throw new DomainError(
        "invalid_service_booking_settings",
        422,
        "Revise as regras de agendamento do servico.",
      );
    }

    if (serviceIds.has(settings.serviceId)) {
      throw new DomainError(
        "duplicate_service_settings",
        422,
        "As regras de um servico foram enviadas mais de uma vez.",
      );
    }
    serviceIds.add(settings.serviceId);
  }

  return {
    expectedVersion: Number(body.expectedVersion),
    requestId: body.requestId,
    rules: body.rules,
    serviceSettings: body.serviceSettings,
    timezone: body.timezone,
  };
}

export function mapScheduleDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;

  const details = error.safeDetails ?? "";

  if (details.includes("schedule_version_conflict")) {
    return new DomainError(
      "schedule_version_conflict",
      409,
      "Os horarios foram alterados em outra sessao. Atualize e tente novamente.",
    );
  }
  if (details.includes("overlapping_availability_rule")) {
    return new DomainError(
      "overlapping_availability_rule",
      409,
      "Existem faixas de disponibilidade sobrepostas.",
    );
  }
  if (details.includes("invalid_schedule_timezone")) {
    return new DomainError(
      "invalid_schedule_timezone",
      422,
      "Selecione um fuso horario valido.",
    );
  }
  if (
    details.includes("invalid_availability_range") ||
    details.includes("invalid_service_booking_settings") ||
    details.includes("invalid_schedule_payload")
  ) {
    return new DomainError(
      "invalid_schedule_payload",
      422,
      "Revise os dados dos horarios.",
    );
  }
  if (
    details.includes("schedule_service_forbidden") ||
    details.includes("schedule_rule_forbidden") ||
    details.includes("therapist_access")
  ) {
    return new DomainError(
      "schedule_forbidden",
      403,
      "Voce nao pode alterar estes horarios.",
    );
  }

  return error;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isClock(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}
