import type {
  TherapistProfileCommand,
  TherapistProfileEditableFields,
  TherapistProfileEditorPayload,
} from "./therapist-profile-editor.types";
import { isPublicProfileThemeId } from "@/features/therapist-profile/personalization";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TherapistProfileContractError extends Error {
  readonly reason: string;

  constructor(reason = "generic") {
    super("Invalid therapist profile contract.");
    this.name = "TherapistProfileContractError";
    this.reason = reason;
  }
}

export function parseTherapistProfileCommand(
  input: unknown,
): TherapistProfileCommand {
  const value = object(input);
  const action = string(value.action, "action");

  if (action === "read") return { action };

  if (action === "check_slug_availability") {
    return {
      action,
      slug: boundedString(value.slug, 1, 120, "slug"),
    };
  }

  if (action === "update_slug") {
    return {
      action,
      expectedVersion: integer(
        value.expectedVersion,
        1,
        999999999,
        "expected_version",
      ),
      requestId: uuid(value.requestId, "request_id"),
      slug: boundedString(value.slug, 1, 120, "slug"),
    };
  }

  if (action === "save_draft") {
    const preserveLegacyVideoUrl = value.preserveLegacyVideoUrl === true;
    if (
      value.preserveLegacyVideoUrl !== undefined &&
      value.preserveLegacyVideoUrl !== true
    ) {
      throw invalid("preserve_legacy_video_url");
    }

    return {
      action,
      expectedVersion: integer(
        value.expectedVersion,
        1,
        999999999,
        "expected_version",
      ),
      payload: parseEditorPayload(value.payload, { preserveLegacyVideoUrl }),
      ...(preserveLegacyVideoUrl ? { preserveLegacyVideoUrl: true } : {}),
      requestId: uuid(value.requestId, "request_id"),
    };
  }

  if (
    action === "discard_draft" ||
    action === "publish" ||
    action === "unpublish"
  ) {
    return {
      action,
      expectedVersion: integer(
        value.expectedVersion,
        1,
        999999999,
        "expected_version",
      ),
      requestId: uuid(value.requestId, "request_id"),
    };
  }

  throw invalid("action");
}

export function parseEditorPayload(
  input: unknown,
  options: { preserveLegacyVideoUrl?: boolean } = {},
): TherapistProfileEditorPayload {
  const value = object(input);
  const parsedVideoProvider = videoProvider(value.videoProvider);
  const parsedVideoUrl = optionalString(value.videoUrl, 500, "video_url");

  if (
    parsedVideoUrl &&
    ((parsedVideoProvider === "upload" && !isHttpsUrl(parsedVideoUrl)) ||
      (parsedVideoProvider !== "upload" &&
        !isAllowedExternalVideoUrl(parsedVideoUrl) &&
        !(
          options.preserveLegacyVideoUrl &&
          parsedVideoProvider === "external" &&
          isHttpsUrl(parsedVideoUrl)
        )))
  ) {
    throw invalid("video_url");
  }

  return {
    bioIllustrationId: bioIllustrationId(value.bioIllustrationId),
    bio: optionalString(value.bio, 1600, "bio"),
    city: optionalString(value.city, 80, "city"),
    essenceBody: optionalString(value.essenceBody, 1600, "essence_body"),
    experienceYears:
      value.experienceYears === null || value.experienceYears === undefined
        ? null
        : integer(value.experienceYears, 0, 80, "experience_years"),
    guideItems: optionalArray(value.guideItems, 6, "guide_items").map(
      (item) => ({
        icon: optionalString(item.icon, 40, "guide_items") || "sparkles",
        label: boundedString(item.label, 1, 80, "guide_items"),
      }),
    ),
    headline: optionalString(value.headline, 180, "headline"),
    invitationBody: optionalString(
      value.invitationBody,
      600,
      "invitation_body",
    ),
    photoUrl: optionalString(value.photoUrl, 500, "photo_url"),
    publicName: boundedString(value.publicName, 2, 120, "public_name"),
    publicProfileTheme: publicProfileTheme(value.publicProfileTheme),
    reflections: optionalArray(value.reflections, 6, "reflections").map(
      (item) => ({
        excerpt: optionalString(item.excerpt, 240, "reflections"),
        href: optionalString(item.href, 500, "reflections"),
        imageUrl: optionalString(item.imageUrl, 500, "reflections"),
        minutesToRead:
          item.minutesToRead === undefined || item.minutesToRead === null
            ? 3
            : integer(item.minutesToRead, 1, 60, "reflections"),
        title: boundedString(item.title, 1, 120, "reflections"),
      }),
    ),
    shortIntro: optionalString(value.shortIntro, 280, "short_intro"),
    state: optionalString(value.state, 40, "state"),
    videoProvider: parsedVideoProvider,
    videoThumbnailUrl: optionalString(
      value.videoThumbnailUrl,
      500,
      "video_thumbnail_url",
    ),
    videoTitle: optionalString(value.videoTitle, 120, "video_title"),
    videoUrl: parsedVideoUrl,
  };
}

export function createEmptyEditorFields(): TherapistProfileEditableFields {
  return {
    bioIllustrationId: null,
    bio: "",
    city: "",
    essenceBody: "",
    experienceYears: null,
    guideItems: [],
    headline: "",
    invitationBody: "",
    photoUrl: "",
    publicName: "",
    publicProfileTheme: "serene",
    reflections: [],
    shortIntro: "",
    state: "",
    videoProvider: "external",
    videoThumbnailUrl: "",
    videoTitle: "",
    videoUrl: "",
  };
}

function publicProfileTheme(value: unknown) {
  if (value === undefined || value === null || value === "") return "serene";
  if (isPublicProfileThemeId(value)) return value;
  throw invalid("public_profile_theme");
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
  throw invalid("bio_illustration_id");
}

function boundedString(
  value: unknown,
  min: number,
  max: number,
  reason = "string",
) {
  if (typeof value !== "string") throw invalid(reason);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw invalid(reason);
  }
  return normalized;
}

function integer(value: unknown, min: number, max: number, reason = "integer") {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw invalid(reason);
  }
  return Number(value);
}

function object(input: unknown, reason = "object"): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw invalid(reason);
  }
  return input as Record<string, unknown>;
}

function optionalArray(input: unknown, maxLength: number, reason = "array") {
  if (input === null || input === undefined) return [];
  if (!Array.isArray(input) || input.length > maxLength) {
    throw invalid(reason);
  }
  return input.map((item) => object(item, reason));
}

function optionalString(
  value: unknown,
  max: number,
  reason = "optional_string",
) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw invalid(reason);
  const normalized = value.trim();
  if (normalized.length > max) throw invalid(reason);
  return normalized;
}

function string(value: unknown, reason = "string") {
  if (typeof value !== "string") throw invalid(reason);
  return value;
}

function uuid(value: unknown, reason = "uuid") {
  if (typeof value !== "string" || !UUID.test(value)) throw invalid(reason);
  return value;
}

function videoProvider(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "external";
  }
  if (
    value === "external" ||
    value === "upload" ||
    value === "vimeo" ||
    value === "youtube"
  ) {
    return value;
  }
  throw invalid("video_provider");
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
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

function invalid(reason: string) {
  return new TherapistProfileContractError(reason);
}
