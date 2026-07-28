import { createEmptyEditorFields } from "./therapist-profile-editor.parsers";
import type {
  TherapistProfileAccountStatus,
  TherapistProfileCapabilities,
  TherapistProfileCompleteness,
  TherapistProfileDerivedData,
  TherapistProfileEditableFields,
  TherapistProfileEditorData,
  TherapistProfileMutationResult,
  TherapistProfilePublicStatus,
  TherapistProfileVerificationStatus,
  TherapistProfileVersionedContent,
} from "./therapist-profile-editor.types";

type JsonObject = Record<string, unknown>;

export function mapTherapistProfileEditorContract(
  input: unknown,
): TherapistProfileEditorData {
  const value = asObject(input);
  const published = asObject(value.published);

  return {
    capabilities: mapCapabilities(value.capabilities),
    completeness: mapCompleteness(value.completeness),
    derived: mapDerived(value.derived),
    draft: value.draft ? mapVersionedContent(value.draft, "draft") : null,
    propagationNotice: stringOr(
      value.propagationNotice,
      "As alterações publicadas podem levar até 2 a 3 horas para aparecer em todas as superfícies públicas.",
    ),
    publicProfileHref: stringOr(value.publicProfileHref, "/terapeutas"),
    published: mapVersionedContent(published, "published"),
    therapistProfileId: requiredString(value.therapistProfileId),
    updatedAt: requiredString(value.updatedAt),
    version: numberOr(value.version, 1),
  };
}

export function mapTherapistProfileMutationResult(
  input: unknown,
): TherapistProfileMutationResult {
  const value = asObject(input);
  return {
    editor: mapTherapistProfileEditorContract(value.editor),
    idempotentReplay: Boolean(value.idempotentReplay),
  };
}

export function buildInitialEditorFields(
  editor: TherapistProfileEditorData,
): TherapistProfileEditableFields {
  return editor.draft?.fields ?? editor.published.fields;
}

export function serializeEditorPayload(fields: TherapistProfileEditableFields) {
  return {
    ...fields,
    bio: emptyToNull(fields.bio),
    city: emptyToNull(fields.city),
    essenceBody: emptyToNull(fields.essenceBody),
    headline: emptyToNull(fields.headline),
    invitationBody: emptyToNull(fields.invitationBody),
    photoUrl: emptyToNull(fields.photoUrl),
    shortIntro: emptyToNull(fields.shortIntro),
    state: emptyToNull(fields.state),
    videoThumbnailUrl: emptyToNull(fields.videoThumbnailUrl),
    videoTitle: emptyToNull(fields.videoTitle),
    videoUrl: emptyToNull(fields.videoUrl),
  };
}

function mapCapabilities(input: unknown): TherapistProfileCapabilities {
  const value = asObject(input);
  return {
    canPublishAdditionalServices: Boolean(value.canPublishAdditionalServices),
    canPublishProfile: Boolean(value.canPublishProfile),
    canUploadVideo: Boolean(value.canUploadVideo),
    canUseAdvancedSections: Boolean(value.canUseAdvancedSections),
    canUseFeaturedMedia: Boolean(value.canUseFeaturedMedia),
  };
}

function mapCompleteness(input: unknown): TherapistProfileCompleteness {
  const value = asObject(input);
  return {
    items: array(value.items).map((item) => {
      const object = asObject(item);
      return {
        complete: Boolean(object.complete),
        key: requiredString(object.key),
        label: requiredString(object.label),
      };
    }),
    percent: numberOr(value.percent, 0),
    score: numberOr(value.score, 0),
    total: numberOr(value.total, 0),
  };
}

function mapDerived(input: unknown): TherapistProfileDerivedData {
  const value = asObject(input);
  return {
    accountStatus: accountStatus(value.accountStatus),
    activeServiceCount: numberOr(value.activeServiceCount, 0),
    availabilityRuleCount: numberOr(value.availabilityRuleCount, 0),
    averageRating:
      value.averageRating === null || value.averageRating === undefined
        ? null
        : numberOr(value.averageRating, 0),
    canReceiveBookings: Boolean(value.canReceiveBookings),
    completedSessions: numberOr(value.completedSessions, 0),
    hasAvailability: Boolean(value.hasAvailability),
    plan: plan(value.plan),
    publicStatus: publicStatus(value.publicStatus),
    reviewCount: numberOr(value.reviewCount, 0),
    startingPriceCents:
      value.startingPriceCents === null ||
      value.startingPriceCents === undefined
        ? null
        : numberOr(value.startingPriceCents, 0),
    verificationStatus: verificationStatus(value.verificationStatus),
  };
}

function mapEditableFields(input: unknown): TherapistProfileEditableFields {
  const value = asObject(input);
  const fallback = createEmptyEditorFields();

  return {
    bio: stringOr(value.bio, fallback.bio),
    city: stringOr(value.city, fallback.city),
    essenceBody: stringOr(value.essenceBody, fallback.essenceBody),
    experienceYears:
      value.experienceYears === null || value.experienceYears === undefined
        ? null
        : numberOr(value.experienceYears, 0),
    guideItems: array(value.guideItems).map((item) => {
      const object = asObject(item);
      return {
        icon: stringOr(object.icon, "sparkles"),
        label: stringOr(object.label, ""),
      };
    }),
    headline: stringOr(value.headline, fallback.headline),
    invitationBody: stringOr(value.invitationBody, fallback.invitationBody),
    photoUrl: stringOr(value.photoUrl, fallback.photoUrl),
    publicName: stringOr(value.publicName, fallback.publicName),
    reflections: array(value.reflections).map((item) => {
      const object = asObject(item);
      return {
        excerpt: stringOr(object.excerpt, ""),
        href: stringOr(object.href, ""),
        imageUrl: stringOr(object.imageUrl, ""),
        minutesToRead: numberOr(object.minutesToRead, 3),
        title: stringOr(object.title, ""),
      };
    }),
    shortIntro: stringOr(value.shortIntro, fallback.shortIntro),
    state: stringOr(value.state, fallback.state),
    videoProvider: videoProvider(value.videoProvider),
    videoThumbnailUrl: stringOr(
      value.videoThumbnailUrl,
      fallback.videoThumbnailUrl,
    ),
    videoTitle: stringOr(value.videoTitle, fallback.videoTitle),
    videoUrl: stringOr(value.videoUrl, fallback.videoUrl),
  };
}

function mapVersionedContent(
  input: unknown,
  fallbackStatus: "draft" | "published",
): TherapistProfileVersionedContent {
  const value = asObject(input);

  return {
    baseProfileVersion:
      value.baseProfileVersion === null ||
      value.baseProfileVersion === undefined
        ? null
        : numberOr(value.baseProfileVersion, 0),
    contentVersionId:
      value.contentVersionId === null || value.contentVersionId === undefined
        ? null
        : requiredString(value.contentVersionId),
    fields: mapEditableFields(value.fields),
    publishedAt:
      value.publishedAt === null || value.publishedAt === undefined
        ? null
        : requiredString(value.publishedAt),
    status: value.status === "draft" ? "draft" : fallbackStatus,
    updatedAt:
      value.updatedAt === null || value.updatedAt === undefined
        ? null
        : requiredString(value.updatedAt),
  };
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function plan(value: unknown) {
  if (value === "premium" || value === "premium_plus") return value;
  return "free";
}

function accountStatus(value: unknown): TherapistProfileAccountStatus {
  if (
    value === "approved" ||
    value === "changes_requested" ||
    value === "in_review" ||
    value === "rejected" ||
    value === "submitted" ||
    value === "suspended"
  ) {
    return value;
  }
  return "draft";
}

function publicStatus(value: unknown): TherapistProfilePublicStatus {
  if (
    value === "archived" ||
    value === "published" ||
    value === "suspended" ||
    value === "unpublished"
  ) {
    return value;
  }
  return "draft";
}

function requiredString(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Invalid therapist profile editor contract.");
  }
  return value;
}

function verificationStatus(
  value: unknown,
): TherapistProfileVerificationStatus {
  return accountStatus(value);
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function videoProvider(value: unknown) {
  if (
    value === "upload" ||
    value === "vimeo" ||
    value === "youtube" ||
    value === "external"
  ) {
    return value;
  }
  return "external";
}
