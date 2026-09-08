import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const THEME_KEYS = new Set([
  "self_knowledge",
  "emotional_wellbeing",
  "relationships_and_bonds",
  "communication",
  "personal_boundaries",
  "self_esteem_and_confidence",
  "routine_and_self_care",
  "habits_and_organization",
  "work_and_career",
  "purpose_and_life_projects",
  "family",
  "parenting",
  "partnership",
  "life_transitions",
  "body_and_presence",
  "other_topic",
]);

export type SessionJourneyThemeCommandBody = {
  acknowledged?: boolean;
  bookingId?: string;
  requestId?: string;
  themeKeys?: string[];
};

export type ValidSessionJourneyThemeCommand = {
  acknowledged: true;
  bookingId: string;
  requestId: string;
  themeKeys: string[];
};

export function validateSessionJourneyThemeCommand(
  body: SessionJourneyThemeCommandBody,
): ValidSessionJourneyThemeCommand {
  if (!body || typeof body !== "object") invalid();

  if (
    !isUuid(body.bookingId) ||
    !isUuid(body.requestId) ||
    body.acknowledged !== true ||
    !Array.isArray(body.themeKeys) ||
    body.themeKeys.length < 1 ||
    body.themeKeys.length > 3 ||
    body.themeKeys.some((key) => typeof key !== "string" || !THEME_KEYS.has(key)) ||
    new Set(body.themeKeys).size !== body.themeKeys.length
  ) {
    invalid();
  }

  return {
    acknowledged: true,
    bookingId: body.bookingId,
    requestId: body.requestId,
    themeKeys: [...body.themeKeys].sort(),
  };
}

export function mapSessionJourneyThemeDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;

  const details = error.safeDetails ?? "";
  if (details.includes("JOURNEY_THEME_THERAPIST_PREMIUM_PLUS_REQUIRED")) {
    return new DomainError(
      "FORBIDDEN",
      403,
      "Esta opção está disponível no Premium Plus.",
    );
  }
  if (details.includes("JOURNEY_THEME_SESSION_NOT_ELIGIBLE")) {
    return new DomainError(
      "UNAVAILABLE",
      409,
      "Os temas ficam disponíveis depois que a sessão realizada é confirmada.",
    );
  }
  if (details.includes("JOURNEY_THEME_SELECTION_IMMUTABLE")) {
    return new DomainError(
      "REQUEST_CONFLICT",
      409,
      "Os temas desta sessão já foram registrados.",
    );
  }
  if (details.includes("JOURNEY_THEME_VALIDATION_ERROR")) {
    return new DomainError("VALIDATION_ERROR", 422, "Revise os temas selecionados.");
  }

  return new DomainError(
    "UNAVAILABLE",
    error.status >= 500 ? 503 : 400,
    "Não foi possível registrar os temas agora.",
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function invalid(): never {
  throw new DomainError("VALIDATION_ERROR", 422, "Revise os temas selecionados.");
}
