import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TherapistProfileCommandBody =
  | { action?: "read" }
  | {
      action?: "save_draft";
      expectedVersion?: number;
      payload?: unknown;
      requestId?: string;
    }
  | {
      action?: "discard_draft" | "publish" | "unpublish";
      expectedVersion?: number;
      requestId?: string;
    }
  | {
      action?: "check_slug_availability";
      slug?: string;
    }
  | {
      action?: "update_slug";
      expectedVersion?: number;
      requestId?: string;
      slug?: string;
    };

export type TherapistProfileEditorPayload = {
  bio: string | null;
  city: string | null;
  essenceBody: string | null;
  experienceYears: number | null;
  guideItems: Array<{ icon: string; label: string }>;
  headline: string | null;
  invitationBody: string | null;
  photoUrl: string | null;
  publicName: string;
  reflections: Array<{
    excerpt: string | null;
    href: string | null;
    imageUrl: string | null;
    minutesToRead: number;
    title: string;
  }>;
  shortIntro: string | null;
  state: string | null;
  videoProvider: "external" | "upload" | "vimeo" | "youtube";
  videoThumbnailUrl: string | null;
  videoTitle: string | null;
  videoUrl: string | null;
  publicProfileTheme: "essential" | "natural" | "serene" | "warm";
  bioIllustrationId:
    | "essential_lines"
    | "gentle_horizon"
    | "organic_flow"
    | "warm_layers"
    | null;
};

export type ValidTherapistProfileCommand =
  | { action: "read" }
  | {
      action: "save_draft";
      expectedVersion: number;
      payload: TherapistProfileEditorPayload;
      requestId: string;
    }
  | {
      action: "discard_draft" | "publish" | "unpublish";
      expectedVersion: number;
      requestId: string;
    }
  | { action: "check_slug_availability"; slug: string }
  | {
      action: "update_slug";
      expectedVersion: number;
      requestId: string;
      slug: string;
    };

export function validateTherapistProfileCommand(
  body: TherapistProfileCommandBody,
): ValidTherapistProfileCommand {
  if (body.action === "read") return { action: "read" };

  if (body.action === "save_draft") {
    if (
      !isUuid(body.requestId) ||
      !isInteger(body.expectedVersion, 1, 999999999)
    ) {
      invalid();
    }

    return {
      action: "save_draft",
      expectedVersion: body.expectedVersion,
      payload: validatePayload(body.payload),
      requestId: body.requestId,
    };
  }

  if (body.action === "check_slug_availability") {
    return {
      action: body.action,
      slug: boundedString(body.slug, 1, 120),
    };
  }

  if (body.action === "update_slug") {
    if (
      !isUuid(body.requestId) ||
      !isInteger(body.expectedVersion, 1, 999999999)
    ) {
      invalid();
    }
    return {
      action: body.action,
      expectedVersion: body.expectedVersion,
      requestId: body.requestId,
      slug: boundedString(body.slug, 1, 120),
    };
  }

  if (
    body.action === "discard_draft" ||
    body.action === "publish" ||
    body.action === "unpublish"
  ) {
    if (
      !isUuid(body.requestId) ||
      !isInteger(body.expectedVersion, 1, 999999999)
    ) {
      invalid();
    }

    return {
      action: body.action,
      expectedVersion: body.expectedVersion,
      requestId: body.requestId,
    };
  }

  invalid();
}

export function mapTherapistProfileDatabaseError(error: unknown) {
  if (!(error instanceof SupabaseHttpError)) return error;
  const details = error.safeDetails ?? "";

  if (details.includes("PROFILE_IDEMPOTENCY_CONFLICT")) {
    return new DomainError(
      "VERSION_CONFLICT",
      409,
      "Esta operação já foi usada com outros dados.",
    );
  }
  if (details.includes("VERSION_CONFLICT")) {
    return new DomainError(
      "VERSION_CONFLICT",
      409,
      "Seu perfil foi alterado em outra sessão. Atualize e tente novamente.",
    );
  }
  if (details.includes("PROFILE_NOT_FOUND")) {
    return new DomainError(
      "PROFILE_NOT_FOUND",
      404,
      "Perfil profissional não encontrado.",
    );
  }
  if (details.includes("PROFILE_LOCKED")) {
    return new DomainError(
      "PROFILE_LOCKED",
      403,
      "Este perfil não pode ser alterado agora.",
    );
  }
  if (details.includes("CAPABILITY_NOT_ALLOWED")) {
    return new DomainError(
      "CAPABILITY_NOT_ALLOWED",
      403,
      "Seu plano atual não permite este recurso.",
    );
  }
  if (details.includes("SLUG_TAKEN")) {
    return new DomainError(
      "SLUG_TAKEN",
      409,
      "Este link acabou de ser escolhido. Tente outra opção.",
    );
  }
  if (details.includes("SLUG_RESERVED")) {
    return new DomainError(
      "SLUG_RESERVED",
      422,
      "Este endereço é reservado pela plataforma.",
    );
  }
  if (details.includes("SLUG_INVALID")) {
    return new DomainError(
      "SLUG_INVALID",
      422,
      "Use de 3 a 40 caracteres para criar seu link.",
    );
  }
  if (details.includes("VALIDATION_ERROR")) {
    return new DomainError(
      "VALIDATION_ERROR",
      422,
      "Revise os dados do perfil antes de continuar.",
    );
  }
  if (
    details.includes("therapist_access") ||
    details.includes("role_mismatch")
  ) {
    return new DomainError(
      "FORBIDDEN",
      403,
      "Use uma conta de terapeuta para continuar.",
    );
  }

  return error;
}

function validatePayload(input: unknown): TherapistProfileEditorPayload {
  if (!input || typeof input !== "object") invalid();
  const value = input as Record<string, unknown>;
  const publicName = boundedString(value.publicName, 2, 120);

  return {
    bio: nullableString(value.bio, 1600),
    city: nullableString(value.city, 80),
    essenceBody: nullableString(value.essenceBody, 1600),
    experienceYears:
      value.experienceYears === null || value.experienceYears === undefined
        ? null
        : integer(value.experienceYears, 0, 80),
    guideItems: array(value.guideItems, 6).map((item) => ({
      icon: nullableString(item.icon, 40) ?? "sparkles",
      label: boundedString(item.label, 1, 80),
    })),
    headline: nullableString(value.headline, 180),
    invitationBody: nullableString(value.invitationBody, 600),
    photoUrl: nullableString(value.photoUrl, 500),
    publicProfileTheme: publicProfileTheme(value.publicProfileTheme),
    bioIllustrationId: bioIllustrationId(value.bioIllustrationId),
    publicName,
    reflections: array(value.reflections, 6).map((item) => ({
      excerpt: nullableString(item.excerpt, 240),
      href: nullableString(item.href, 500),
      imageUrl: nullableString(item.imageUrl, 500),
      minutesToRead:
        item.minutesToRead === undefined || item.minutesToRead === null
          ? 3
          : integer(item.minutesToRead, 1, 60),
      title: boundedString(item.title, 1, 120),
    })),
    shortIntro: nullableString(value.shortIntro, 280),
    state: nullableString(value.state, 40),
    videoProvider: videoProvider(value.videoProvider),
    videoThumbnailUrl: nullableString(value.videoThumbnailUrl, 500),
    videoTitle: nullableString(value.videoTitle, 120),
    videoUrl: nullableString(value.videoUrl, 500),
  };
}

function publicProfileTheme(value: unknown) {
  if (value === undefined || value === null || value === "") return "serene";
  if (
    value === "serene" ||
    value === "natural" ||
    value === "warm" ||
    value === "essential"
  )
    return value;
  invalid();
}

function bioIllustrationId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (
    value === "organic_flow" ||
    value === "gentle_horizon" ||
    value === "warm_layers" ||
    value === "essential_lines"
  )
    return value;
  invalid();
}

function array(
  value: unknown,
  maxLength: number,
): Array<Record<string, unknown>> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxLength) invalid();
  return value.map((item) => {
    if (!item || typeof item !== "object") invalid();
    return item as Record<string, unknown>;
  });
}

function boundedString(value: unknown, min: number, max: number) {
  if (typeof value !== "string") invalid();
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) invalid();
  return normalized;
}

function integer(value: unknown, min: number, max: number) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    invalid();
  }
  return Number(value);
}

function nullableString(value: unknown, max: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") invalid();
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) invalid();
  return normalized;
}

function videoProvider(value: unknown) {
  if (value === undefined || value === null || value === "") return "external";
  if (
    value === "external" ||
    value === "upload" ||
    value === "vimeo" ||
    value === "youtube"
  ) {
    return value;
  }
  invalid();
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return (
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function invalid(): never {
  throw new DomainError(
    "VALIDATION_ERROR",
    422,
    "Revise os dados do perfil antes de continuar.",
  );
}
