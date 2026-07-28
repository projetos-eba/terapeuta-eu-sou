import type {
  TherapistProfileCommand,
  TherapistProfileEditableFields,
  TherapistProfileEditorPayload,
} from "./therapist-profile-editor.types";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TherapistProfileContractError extends Error {
  constructor(message = "Invalid therapist profile contract.") {
    super(message);
    this.name = "TherapistProfileContractError";
  }
}

export function parseTherapistProfileCommand(
  input: unknown,
): TherapistProfileCommand {
  const value = object(input);
  const action = string(value.action);

  if (action === "read") return { action };

  if (action === "save_draft") {
    return {
      action,
      expectedVersion: integer(value.expectedVersion, 1, 999999999),
      payload: parseEditorPayload(value.payload),
      requestId: uuid(value.requestId),
    };
  }

  if (
    action === "discard_draft" ||
    action === "publish" ||
    action === "unpublish"
  ) {
    return {
      action,
      expectedVersion: integer(value.expectedVersion, 1, 999999999),
      requestId: uuid(value.requestId),
    };
  }

  throw invalid("action");
}

export function parseEditorPayload(
  input: unknown,
): TherapistProfileEditorPayload {
  const value = object(input);

  return {
    bio: optionalString(value.bio, 1600),
    city: optionalString(value.city, 80),
    essenceBody: optionalString(value.essenceBody, 1600),
    experienceYears:
      value.experienceYears === null || value.experienceYears === undefined
        ? null
        : integer(value.experienceYears, 0, 80),
    guideItems: optionalArray(value.guideItems, 6).map((item) => ({
      icon: optionalString(item.icon, 40) || "sparkles",
      label: boundedString(item.label, 1, 80),
    })),
    headline: optionalString(value.headline, 180),
    invitationBody: optionalString(value.invitationBody, 600),
    photoUrl: optionalString(value.photoUrl, 500),
    publicName: boundedString(value.publicName, 2, 120),
    reflections: optionalArray(value.reflections, 6).map((item) => ({
      excerpt: optionalString(item.excerpt, 240),
      href: optionalString(item.href, 500),
      imageUrl: optionalString(item.imageUrl, 500),
      minutesToRead:
        item.minutesToRead === undefined || item.minutesToRead === null
          ? 3
          : integer(item.minutesToRead, 1, 60),
      title: boundedString(item.title, 1, 120),
    })),
    shortIntro: optionalString(value.shortIntro, 280),
    state: optionalString(value.state, 40),
    videoProvider: videoProvider(value.videoProvider),
    videoThumbnailUrl: optionalString(value.videoThumbnailUrl, 500),
    videoTitle: optionalString(value.videoTitle, 120),
    videoUrl: optionalString(value.videoUrl, 500),
  };
}

export function createEmptyEditorFields(): TherapistProfileEditableFields {
  return {
    bio: "",
    city: "",
    essenceBody: "",
    experienceYears: null,
    guideItems: [],
    headline: "",
    invitationBody: "",
    photoUrl: "",
    publicName: "",
    reflections: [],
    shortIntro: "",
    state: "",
    videoProvider: "external",
    videoThumbnailUrl: "",
    videoTitle: "",
    videoUrl: "",
  };
}

function boundedString(value: unknown, min: number, max: number) {
  if (typeof value !== "string") throw invalid("string");
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw invalid("string_length");
  }
  return normalized;
}

function integer(value: unknown, min: number, max: number) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw invalid("integer");
  }
  return Number(value);
}

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw invalid("object");
  }
  return input as Record<string, unknown>;
}

function optionalArray(input: unknown, maxLength: number) {
  if (input === null || input === undefined) return [];
  if (!Array.isArray(input) || input.length > maxLength) {
    throw invalid("array");
  }
  return input.map(object);
}

function optionalString(value: unknown, max: number) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw invalid("optional_string");
  const normalized = value.trim();
  if (normalized.length > max) throw invalid("optional_string_length");
  return normalized;
}

function string(value: unknown) {
  if (typeof value !== "string") throw invalid("string");
  return value;
}

function uuid(value: unknown) {
  if (typeof value !== "string" || !UUID.test(value)) throw invalid("uuid");
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

function invalid(reason: string) {
  return new TherapistProfileContractError(reason);
}
