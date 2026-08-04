import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const transitions = new Set([
  "archive",
  "deprecate",
  "publish",
  "review",
  "unpublish",
]);

const requestStatuses = new Set([
  "approved",
  "merged",
  "needs_information",
  "rejected",
  "under_review",
]);

export type AdminTherapyCatalogCommandBody =
  | { action?: "list" }
  | { action?: "matchingList" }
  | {
      action?: "matchingSaveTheme";
      payload?: unknown;
      requestId?: string;
    }
  | {
      action?: "matchingSaveInterest";
      payload?: unknown;
      requestId?: string;
    }
  | {
      action?: "matchingTransition";
      entityId?: string;
      entityType?: string;
      matchingAction?: string;
      reason?: string;
      requestId?: string;
    }
  | { action?: "impact"; therapyId?: string }
  | {
      action?: "save";
      payload?: unknown;
      requestId?: string;
    }
  | {
      action?: "transition";
      payload?: Record<string, unknown>;
      reason?: string;
      requestId?: string;
      therapyId?: string;
      transition?: string;
    }
  | {
      action?: "decideRequest";
      catalogRequestId?: string;
      decision?: string;
      relatedTherapyId?: string | null;
      requestId?: string;
      status?: string;
    }
  | {
      action?: "submitRequest";
      payload?: unknown;
    };

export type ValidAdminTherapyCatalogCommand =
  | { action: "list" }
  | { action: "matchingList" }
  | {
      action: "matchingSaveTheme";
      payload: Record<string, unknown>;
      requestId: string;
    }
  | {
      action: "matchingSaveInterest";
      payload: Record<string, unknown>;
      requestId: string;
    }
  | {
      action: "matchingTransition";
      entityId: string;
      entityType: "theme" | "interest";
      matchingAction: "activate" | "deactivate";
      reason: string;
      requestId: string;
    }
  | { action: "impact"; therapyId: string }
  | { action: "save"; payload: Record<string, unknown>; requestId: string }
  | {
      action: "transition";
      payload: Record<string, unknown>;
      reason: string;
      requestId: string;
      therapyId: string;
      transition: string;
    }
  | {
      action: "decideRequest";
      catalogRequestId: string;
      decision: string;
      relatedTherapyId: string | null;
      requestId: string;
      status: string;
    }
  | { action: "submitRequest"; payload: Record<string, unknown> };

export function validateAdminTherapyCatalogCommand(
  body: AdminTherapyCatalogCommandBody,
): ValidAdminTherapyCatalogCommand {
  if (body.action === "list") return { action: "list" };
  if (body.action === "matchingList") return { action: "matchingList" };

  if (body.action === "matchingSaveTheme") {
    if (!isUuid(body.requestId) || !isRecord(body.payload)) invalid();
    return {
      action: "matchingSaveTheme",
      payload: body.payload,
      requestId: body.requestId,
    };
  }

  if (body.action === "matchingSaveInterest") {
    if (!isUuid(body.requestId) || !isRecord(body.payload)) invalid();
    return {
      action: "matchingSaveInterest",
      payload: body.payload,
      requestId: body.requestId,
    };
  }

  if (body.action === "matchingTransition") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (
      !isUuid(body.requestId) ||
      !isUuid(body.entityId) ||
      (body.entityType !== "theme" && body.entityType !== "interest") ||
      (body.matchingAction !== "activate" &&
        body.matchingAction !== "deactivate") ||
      !isBoundedString(reason, 4, 500)
    ) {
      invalid();
    }

    return {
      action: "matchingTransition",
      entityId: body.entityId,
      entityType: body.entityType,
      matchingAction: body.matchingAction,
      reason,
      requestId: body.requestId,
    };
  }

  if (body.action === "impact") {
    if (!isUuid(body.therapyId)) invalid();
    return { action: "impact", therapyId: body.therapyId };
  }

  if (body.action === "save") {
    if (!isUuid(body.requestId) || !isRecord(body.payload)) invalid();
    return {
      action: "save",
      payload: body.payload,
      requestId: body.requestId,
    };
  }

  if (body.action === "transition") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (
      !isUuid(body.requestId) ||
      !isUuid(body.therapyId) ||
      !body.transition ||
      !transitions.has(body.transition) ||
      !isBoundedString(reason, 4, 500)
    ) {
      invalid();
    }

    return {
      action: "transition",
      payload: isRecord(body.payload) ? body.payload : {},
      reason,
      requestId: body.requestId,
      therapyId: body.therapyId,
      transition: body.transition,
    };
  }

  if (body.action === "decideRequest") {
    const decision =
      typeof body.decision === "string" ? body.decision.trim() : "";
    if (
      !isUuid(body.requestId) ||
      !isUuid(body.catalogRequestId) ||
      !body.status ||
      !requestStatuses.has(body.status) ||
      !isBoundedString(decision, 4, 800) ||
      (body.relatedTherapyId !== null &&
        body.relatedTherapyId !== undefined &&
        !isUuid(body.relatedTherapyId))
    ) {
      invalid();
    }

    return {
      action: "decideRequest",
      catalogRequestId: body.catalogRequestId,
      decision,
      relatedTherapyId: body.relatedTherapyId ?? null,
      requestId: body.requestId,
      status: body.status,
    };
  }

  if (body.action === "submitRequest") {
    if (!isRecord(body.payload)) invalid();
    return { action: "submitRequest", payload: body.payload };
  }

  invalid();
}

export function mapAdminTherapyCatalogDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;
  const details = error.safeDetails ?? "";

  if (details.includes("ADMIN_THERAPY_CATALOG_ADMIN_REQUIRED")) {
    return new DomainError(
      "admin_required",
      403,
      "Acesso administrativo necessario.",
    );
  }
  if (details.includes("ADMIN_THERAPY_CATALOG_SLUG_CONFLICT")) {
    return new DomainError(
      "slug_conflict",
      409,
      "Este slug ja esta em uso no catalogo.",
    );
  }
  if (details.includes("ADMIN_THERAPY_CATALOG_INCOMPLETE_PUBLIC_CONTENT")) {
    return new DomainError(
      "incomplete_public_content",
      422,
      "Complete o conteudo publico antes de publicar.",
    );
  }
  if (details.includes("ADMIN_THERAPY_CATALOG_INACTIVE_CATEGORY")) {
    return new DomainError(
      "inactive_category",
      422,
      "A categoria precisa estar ativa para publicar.",
    );
  }
  if (details.includes("ADMIN_THERAPY_CATALOG_THEME_REQUIRED")) {
    return new DomainError(
      "theme_required",
      422,
      "Selecione pelo menos um tema do Match antes de publicar.",
    );
  }
  if (details.includes("ADMIN_THERAPY_CATALOG_INVALID_THEME_LIMIT")) {
    return new DomainError(
      "theme_limit",
      422,
      "Selecione de um a tres temas para a terapia.",
    );
  }
  if (details.includes("ADMIN_THERAPY_CATALOG_INVALID_THEME")) {
    return new DomainError(
      "invalid_theme",
      422,
      "Selecione apenas temas ativos do Match.",
    );
  }
  if (details.includes("ADMIN_THERAPY_CATALOG_UNSAFE_COPY")) {
    return new DomainError(
      "unsafe_copy",
      422,
      "Revise a copy para remover promessas de cura, diagnostico ou resultado garantido.",
    );
  }
  if (details.includes("ADMIN_THERAPY_CATALOG_ARCHIVE_BLOCKED_BY_USAGE")) {
    return new DomainError(
      "archive_blocked_by_usage",
      409,
      "Esta terapia possui servicos ativos ou bookings futuros. Descontinue antes de arquivar.",
    );
  }
  if (
    details.includes("ADMIN_THERAPY_CATALOG_NOT_FOUND") ||
    details.includes("ADMIN_THERAPY_CATALOG_REQUEST_NOT_FOUND")
  ) {
    return new DomainError("not_found", 404, "Registro nao encontrado.");
  }
  if (details.includes("THERAPY_CATALOG_REQUEST_THERAPIST_REQUIRED")) {
    return new DomainError(
      "therapist_required",
      403,
      "Use o acesso de terapeuta para solicitar uma terapia.",
    );
  }
  if (details.includes("ADMIN_MATCHING_SLUG_CONFLICT")) {
    return new DomainError(
      "matching_slug_conflict",
      409,
      "Este slug ja esta em uso no Match.",
    );
  }
  if (details.includes("ADMIN_MATCHING_THEME_DEACTIVATION_BLOCKED")) {
    return new DomainError(
      "matching_theme_deactivation_blocked",
      409,
      "Resolva as terapias publicadas que ficariam sem tema ativo antes de desativar.",
    );
  }
  if (details.includes("ADMIN_MATCHING_INTEREST_THEME_LOCKED")) {
    return new DomainError(
      "matching_interest_theme_locked",
      409,
      "Este refinamento nao pode ser movido para outro tema silenciosamente.",
    );
  }
  if (
    details.includes("ADMIN_MATCHING_THEME_NOT_FOUND") ||
    details.includes("ADMIN_MATCHING_INTEREST_NOT_FOUND")
  ) {
    return new DomainError("matching_not_found", 404, "Registro do Match nao encontrado.");
  }
  if (details.includes("ADMIN_MATCHING_INVALID_PAYLOAD")) {
    return new DomainError(
      "matching_invalid_payload",
      422,
      "Revise nome, slug, ordem e motivo antes de salvar.",
    );
  }

  return new DomainError(
    "catalog_command_failed",
    400,
    "Nao foi possivel atualizar o catalogo agora.",
  );
}

function invalid(): never {
  throw new DomainError("invalid_payload", 422, "Revise os dados enviados.");
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isBoundedString(value: string, min: number, max: number) {
  return value.length >= min && value.length <= max;
}
