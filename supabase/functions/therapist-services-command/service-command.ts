import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TherapistServicesCommandBody =
  | { action?: "catalog" | "list" }
  | {
      action?: "create";
      currency?: "BRL";
      deliveryFormat?: string;
      description?: string | null;
      durationMinutes?: number;
      interestIds?: string[];
      priceCents?: number;
      requestId?: string;
      themeIds?: string[];
      therapyId?: string;
      title?: string;
    }
  | {
      action?: "update";
      currency?: "BRL";
      deliveryFormat?: string;
      description?: string | null;
      durationMinutes?: number;
      expectedVersion?: number;
      interestIds?: string[];
      isBookable?: boolean;
      priceCents?: number;
      requestId?: string;
      serviceId?: string;
      themeIds?: string[];
      therapyId?: string;
      title?: string;
    }
  | {
      action?: "activate" | "archive" | "pause";
      expectedVersion?: number;
      requestId?: string;
      serviceId?: string;
    }
  | {
      action?: "reorder";
      requestId?: string;
      serviceIds?: string[];
    };

export type ValidTherapistServicesCommand =
  | { action: "catalog" | "list" }
  | {
      action: "create";
      payload: {
        currency: "BRL";
        deliveryFormat: "online";
        description: string | null;
        durationMinutes: number;
        interestIds: string[];
        priceCents: number;
        themeIds: string[];
        therapyId: string;
        title: string;
      };
      requestId: string;
    }
  | {
      action: "update";
      expectedVersion: number;
      payload: Record<string, boolean | number | string | string[] | null>;
      requestId: string;
      serviceId: string;
    }
  | {
      action: "activate" | "archive" | "pause";
      expectedVersion: number;
      requestId: string;
      serviceId: string;
    }
  | {
      action: "reorder";
      requestId: string;
      serviceIds: string[];
    };

export function validateTherapistServicesCommand(
  body: TherapistServicesCommandBody,
): ValidTherapistServicesCommand {
  if (body.action === "catalog" || body.action === "list") {
    return { action: body.action };
  }

  if (body.action === "create") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (
      !isUuid(body.requestId) ||
      !isUuid(body.therapyId) ||
      !isBoundedString(title, 1, 120) ||
      !isOptionalDescription(body.description) ||
      !isInteger(body.durationMinutes, 15, 240) ||
      !isInteger(body.priceCents, 1000, 2000000) ||
      !isUuidList(body.themeIds, 1, 3) ||
      !isUuidList(body.interestIds, 0, 9) ||
      !isCurrency(body.currency) ||
      !isOnlineOnlyFormat(body.deliveryFormat)
    ) {
      invalid();
    }

    return {
      action: "create",
      payload: {
        currency: body.currency ?? "BRL",
        deliveryFormat: body.deliveryFormat ?? "online",
        description: normalizeDescription(body.description),
        durationMinutes: body.durationMinutes,
        interestIds: body.interestIds,
        priceCents: body.priceCents,
        themeIds: body.themeIds,
        therapyId: body.therapyId,
        title,
      },
      requestId: body.requestId,
    };
  }

  if (body.action === "update") {
    if (
      !isUuid(body.requestId) ||
      !isUuid(body.serviceId) ||
      !isInteger(body.expectedVersion, 1, 999999999)
    ) {
      invalid();
    }

    const payload: Record<string, boolean | number | string | string[] | null> = {};
    if (body.therapyId !== undefined) {
      if (!isUuid(body.therapyId)) invalid();
      payload.therapyId = body.therapyId;
    }
    if (body.title !== undefined) {
      if (!isBoundedString(body.title, 1, 120)) invalid();
      payload.title = body.title.trim();
    }
    if (body.description !== undefined) {
      if (!isOptionalDescription(body.description)) invalid();
      payload.description = normalizeDescription(body.description);
    }
    if (body.durationMinutes !== undefined) {
      if (!isInteger(body.durationMinutes, 15, 240)) invalid();
      payload.durationMinutes = body.durationMinutes;
    }
    if (body.priceCents !== undefined) {
      if (!isInteger(body.priceCents, 0, 2000000)) invalid();
      payload.priceCents = body.priceCents;
    }
    if (body.currency !== undefined) {
      if (body.currency !== "BRL") invalid();
      payload.currency = body.currency;
    }
    if (body.deliveryFormat !== undefined) {
      if (!isOnlineOnlyFormat(body.deliveryFormat)) invalid();
      payload.deliveryFormat = body.deliveryFormat;
    }
    if (body.isBookable !== undefined) {
      if (typeof body.isBookable !== "boolean") invalid();
      payload.isBookable = body.isBookable;
    }
    if (body.themeIds !== undefined) {
      if (!isUuidList(body.themeIds, 1, 3)) invalid();
      payload.themeIds = body.themeIds;
    }
    if (body.interestIds !== undefined) {
      if (!isUuidList(body.interestIds, 0, 9)) invalid();
      payload.interestIds = body.interestIds;
    }

    if (Object.keys(payload).length === 0) invalid();

    return {
      action: "update",
      expectedVersion: body.expectedVersion,
      payload,
      requestId: body.requestId,
      serviceId: body.serviceId,
    };
  }

  if (
    body.action === "activate" ||
    body.action === "pause" ||
    body.action === "archive"
  ) {
    if (
      !isUuid(body.requestId) ||
      !isUuid(body.serviceId) ||
      !isInteger(body.expectedVersion, 1, 999999999)
    ) {
      invalid();
    }

    return {
      action: body.action,
      expectedVersion: body.expectedVersion,
      requestId: body.requestId,
      serviceId: body.serviceId,
    };
  }

  if (body.action === "reorder") {
    if (
      !isUuid(body.requestId) ||
      !Array.isArray(body.serviceIds) ||
      body.serviceIds.length === 0 ||
      body.serviceIds.length > 100 ||
      body.serviceIds.some((id) => !isUuid(id)) ||
      new Set(body.serviceIds).size !== body.serviceIds.length
    ) {
      invalid();
    }

    return {
      action: "reorder",
      requestId: body.requestId,
      serviceIds: body.serviceIds,
    };
  }

  invalid();
}

export function mapTherapistServiceDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;
  const details = error.safeDetails ?? "";

  if (details.includes("THERAPIST_SERVICE_IDEMPOTENCY_CONFLICT")) {
    return new DomainError(
      "idempotency_conflict",
      409,
      "Esta operação já foi usada com outros dados.",
    );
  }
  if (details.includes("THERAPIST_SERVICE_VERSION_CONFLICT")) {
    return new DomainError(
      "version_conflict",
      409,
      "Este serviço foi alterado em outra sessão. Atualize e tente novamente.",
    );
  }
  if (details.includes("THERAPIST_SERVICE_DUPLICATE_THERAPY")) {
    return new DomainError(
      "duplicate_therapy",
      409,
      "Você já possui um serviço ativo ou em edição para esta terapia.",
    );
  }
  if (details.includes("INVALID_THEME_RELATION")) {
    return new DomainError(
      "invalid_theme_relation",
      422,
      "Selecione apenas temas vinculados a esta terapia.",
    );
  }
  if (details.includes("INVALID_INTEREST_RELATION")) {
    return new DomainError(
      "invalid_interest_relation",
      422,
      "Selecione refinamentos apenas dentro dos temas escolhidos.",
    );
  }
  if (details.includes("LIMIT_EXCEEDED")) {
    return new DomainError(
      "limit_exceeded",
      422,
      "Revise os limites de temas e refinamentos do serviço.",
    );
  }
  if (details.includes("THERAPIST_SERVICE_PLAN_LIMIT_REACHED")) {
    return new DomainError(
      "plan_limit_reached",
      403,
      "Seu plano atual não permite criar mais serviços.",
    );
  }
  if (details.includes("THERAPIST_SERVICE_THERAPY_LOCKED")) {
    return new DomainError(
      "therapy_locked",
      409,
      "A terapia deste serviço já possui histórico e não pode ser trocada.",
    );
  }
  if (
    details.includes("THERAPY_NOT_AVAILABLE_FOR_SERVICE") ||
    details.includes("THERAPY_ARCHIVED")
  ) {
    return new DomainError(
      "therapy_not_available",
      422,
      "Esta terapia não está disponível para novos serviços.",
    );
  }
  if (details.includes("THERAPIST_SERVICE_NOT_FOUND")) {
    return new DomainError(
      "not_found",
      404,
      "Este serviço não foi encontrado.",
    );
  }
  if (details.includes("therapist_access")) {
    return new DomainError(
      "unauthorized",
      403,
      "Use uma conta de terapeuta para continuar.",
    );
  }

  return error;
}

function invalid(): never {
  throw new DomainError("invalid_payload", 422, "Revise os dados do serviço.");
}

function isBoundedString(value: unknown, min: number, max: number) {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max
  );
}

function isCurrency(value: unknown) {
  return value === undefined || value === "BRL";
}

function isOnlineOnlyFormat(value: unknown) {
  return value === undefined || value === "online";
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return (
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max
  );
}

function isOptionalDescription(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length <= 200)
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isUuidList(value: unknown, min: number, max: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= min &&
    value.length <= max &&
    value.every((item) => isUuid(item)) &&
    new Set(value).size === value.length
  );
}

function normalizeDescription(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
