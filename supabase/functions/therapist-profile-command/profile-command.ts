import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_THEME_IDS = [
  "ancestral",
  "aurora",
  "botanico",
  "celestial",
  "cristalino",
  "energia",
  "essencial_editorial",
  "essential",
  "frequencia",
  "geometria",
  "lunar",
  "natural",
  "oraculo",
  "profundo",
  "sagrado",
  "sereno_horizonte",
  "serene",
  "vinculos",
  "warm",
] as const;
type ProfileThemeId = (typeof PROFILE_THEME_IDS)[number];
const PROFILE_THEME_ID_SET = new Set<string>(PROFILE_THEME_IDS);

export type TherapistProfileCommandBody =
  | { action?: "read" }
  | {
      action?: "save_draft";
      expectedVersion?: number;
      payload?: unknown;
      requestId?: string;
    }
  | {
      action?: "save_media_draft";
      expectedVersion?: number;
      kind?: "photo";
      mediaUrl?: string;
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
  publicProfileTheme: ProfileThemeId;
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
      action: "save_media_draft";
      expectedVersion: number;
      kind: "photo";
      mediaUrl: string;
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
      invalid("request");
    }

    return {
      action: "save_draft",
      expectedVersion: body.expectedVersion,
      payload: validatePayload(body.payload),
      requestId: body.requestId,
    };
  }

  if (body.action === "save_media_draft") {
    if (
      !isUuid(body.requestId) ||
      !isInteger(body.expectedVersion, 1, 999999999) ||
      body.kind !== "photo"
    ) {
      invalid("request");
    }

    const mediaUrl = boundedString(body.mediaUrl, 1, 500, "photo_url");
    if (
      !isPublicProfileMediaUrl(mediaUrl) ||
      !mediaUrl.includes(
        "/storage/v1/object/public/therapist-public-media/",
      )
    ) {
      invalid("photo_url");
    }

    return {
      action: "save_media_draft",
      expectedVersion: body.expectedVersion,
      kind: "photo",
      mediaUrl,
      requestId: body.requestId,
    };
  }

  if (body.action === "check_slug_availability") {
    return {
      action: body.action,
      slug: boundedString(body.slug, 1, 120, "slug"),
    };
  }

  if (body.action === "update_slug") {
    if (
      !isUuid(body.requestId) ||
      !isInteger(body.expectedVersion, 1, 999999999)
    ) {
      invalid("request");
    }
    return {
      action: body.action,
      expectedVersion: body.expectedVersion,
      requestId: body.requestId,
      slug: boundedString(body.slug, 1, 120, "slug"),
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
      invalid("request");
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
  const publicName = boundedString(value.publicName, 2, 120, "public_name");
  const parsedVideoProvider = videoProvider(value.videoProvider);
  const parsedVideoUrl = nullableString(value.videoUrl, 500, "video_url");

  if (
    parsedVideoUrl &&
    ((parsedVideoProvider === "upload" && !isHttpsUrl(parsedVideoUrl)) ||
      (parsedVideoProvider !== "upload" &&
        !isAllowedExternalVideoUrl(parsedVideoUrl)))
  ) {
    invalid("video_url");
  }

  return {
    bio: nullableString(value.bio, 1600, "bio"),
    city: nullableString(value.city, 80, "city"),
    essenceBody: nullableString(value.essenceBody, 1600, "essence_body"),
    experienceYears:
      value.experienceYears === null || value.experienceYears === undefined
        ? null
        : integer(value.experienceYears, 0, 80, "experience_years"),
    guideItems: array(value.guideItems, 6, "guide_items").map((item) => ({
      icon: nullableString(item.icon, 40, "guide_items") ?? "sparkles",
      label: boundedString(item.label, 1, 80, "guide_items"),
    })),
    headline: nullableString(value.headline, 180, "headline"),
    invitationBody: nullableString(
      value.invitationBody,
      600,
      "invitation_body",
    ),
    photoUrl: nullableString(value.photoUrl, 500, "photo_url"),
    publicProfileTheme: publicProfileTheme(value.publicProfileTheme),
    bioIllustrationId: bioIllustrationId(value.bioIllustrationId),
    publicName,
    reflections: array(value.reflections, 6, "reflections").map((item) => ({
      excerpt: nullableString(item.excerpt, 240, "reflections"),
      href: nullableString(item.href, 500, "reflections"),
      imageUrl: nullableString(item.imageUrl, 500, "reflections"),
      minutesToRead:
        item.minutesToRead === undefined || item.minutesToRead === null
          ? 3
          : integer(item.minutesToRead, 1, 60, "reflections"),
      title: boundedString(item.title, 1, 120, "reflections"),
    })),
    shortIntro: nullableString(value.shortIntro, 280, "short_intro"),
    state: nullableString(value.state, 40, "state"),
    videoProvider: parsedVideoProvider,
    videoThumbnailUrl: nullableString(
      value.videoThumbnailUrl,
      500,
      "video_thumbnail_url",
    ),
    videoTitle: nullableString(value.videoTitle, 120, "video_title"),
    videoUrl: parsedVideoUrl,
  };
}

function publicProfileTheme(value: unknown): ProfileThemeId {
  if (value === undefined || value === null || value === "") return "serene";
  if (typeof value === "string" && PROFILE_THEME_ID_SET.has(value)) {
    return value as ProfileThemeId;
  }
  invalid("public_profile_theme");
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
  invalid("bio_illustration_id");
}

function array(
  value: unknown,
  maxLength: number,
  reason = "array",
): Array<Record<string, unknown>> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxLength) invalid(reason);
  return value.map((item) => {
    if (!item || typeof item !== "object") invalid(reason);
    return item as Record<string, unknown>;
  });
}

function boundedString(
  value: unknown,
  min: number,
  max: number,
  reason = "string",
) {
  if (typeof value !== "string") invalid(reason);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) invalid(reason);
  return normalized;
}

function integer(value: unknown, min: number, max: number, reason = "integer") {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    invalid(reason);
  }
  return Number(value);
}

function nullableString(value: unknown, max: number, reason = "string") {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") invalid(reason);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) invalid(reason);
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
  invalid("video_provider");
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isPublicProfileMediaUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isAllowedExternalVideoUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    return (
      hostname === "youtube.com" ||
      hostname === "youtu.be" ||
      hostname === "vimeo.com"
    );
  } catch {
    return false;
  }
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return (
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function invalid(reason = "generic"): never {
  throw new DomainError("VALIDATION_ERROR", 422, validationMessage(reason));
}

function validationMessage(reason: string) {
  switch (reason) {
    case "public_name":
      return "Informe um nome de perfil entre 2 e 120 caracteres.";
    case "short_intro":
      return "Sua apresentação deve respeitar o limite de 280 caracteres.";
    case "bio":
    case "essence_body":
      return "Revise o texto da sua essência e mantenha-o dentro do limite permitido.";
    case "headline":
      return "O destaque do perfil deve respeitar o limite de 180 caracteres.";
    case "invitation_body":
      return "O convite do perfil deve respeitar o limite de 600 caracteres.";
    case "city":
    case "state":
      return "Revise cidade e estado antes de salvar.";
    case "photo_url":
      return "A foto do perfil precisa ser uma imagem válida.";
    case "video_thumbnail_url":
      return "A capa do vídeo precisa ser uma imagem válida.";
    case "video_title":
      return "O título do vídeo deve respeitar o limite de 120 caracteres.";
    case "experience_years":
      return "Informe uma experiência entre 0 e 80 anos.";
    case "video_url":
      return "Use um link https:// do YouTube ou Vimeo, ou envie um vídeo válido.";
    case "public_profile_theme":
      return "Escolha um visual válido para o seu perfil antes de salvar.";
    case "bio_illustration_id":
      return "Escolha uma ilustração válida para o seu perfil.";
    case "guide_items":
      return "Revise os itens de Como posso te guiar: são permitidos até 6 itens com texto de até 80 caracteres.";
    case "reflections":
      return "Revise os conteúdos e reflexões: são permitidos até 6 itens com títulos válidos.";
    case "request":
      return "A solicitação de salvamento expirou. Atualize a página e tente novamente.";
    case "slug":
      return "Informe um endereço público válido para o perfil.";
    default:
      return "Revise os dados do perfil destacados antes de salvar.";
  }
}
