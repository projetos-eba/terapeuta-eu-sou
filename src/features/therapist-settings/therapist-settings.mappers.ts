import type { TherapistPlan, TherapistStatus } from "@/domain/tes";
import type {
  TherapistPrivateDocumentKind,
  TherapistPrivateDocumentStatus,
  TherapistPrivateDocumentSummary,
  TherapistPrivateDocumentValidationState,
  TherapistProfileVerificationStatus,
} from "@/features/therapist-profile-editor/therapist-profile-editor.types";
import { routes } from "@/lib/routes";

import type {
  TherapistPrivateIdentityDocumentType,
  TherapistPrivateIdentityFields,
  TherapistSettingsData,
  TherapistSettingsUpdateResult,
} from "./therapist-settings.types";

type JsonObject = Record<string, unknown>;

export function mapTherapistSettingsData(
  input: unknown,
): TherapistSettingsData {
  const value = asObject(input);
  const profile = firstObject(value.therapistProfile);

  const slug = stringOr(profile.slug, "");

  return {
    account: {
      displayName: stringOr(value.displayName, ""),
      email: stringOr(value.email, ""),
      phone: stringOr(value.phone, ""),
      userId: requiredString(value.id),
      identity: mapIdentity(value.identity),
    },
    documentCenter: mapDocumentCenter(value.documentCenter),
    profile: {
      isAcceptingBookings: Boolean(profile.isAcceptingBookings),
      isPublic: Boolean(profile.isPublic),
      plan: plan(profile.plan),
      profileId: requiredString(profile.id),
      publicName: stringOr(profile.publicName, ""),
      publicStatus: stringOr(profile.publicStatus, "draft"),
      publicUrl: slug
        ? routes.public.therapistProfile(slug)
        : routes.therapist.profile,
      status: status(profile.status),
    },
  };
}

function mapDocumentCenter(
  value: unknown,
): TherapistSettingsData["documentCenter"] {
  const center = asObject(value);
  return {
    documents: Array.isArray(center.documents)
      ? center.documents.flatMap((item) => {
          try {
            return [mapPrivateDocument(item)];
          } catch {
            return [];
          }
        })
      : [],
    verificationStatus: verificationStatus(center.verificationStatus),
  };
}

function mapPrivateDocument(input: unknown): TherapistPrivateDocumentSummary {
  const value = asObject(input);
  return {
    createdAt: requiredString(value.uploadedAt),
    fileName: requiredString(value.fileName),
    fileSizeBytes: numberOr(value.sizeBytes, 0),
    id: requiredString(value.id),
    kind: privateDocumentKind(value.kind),
    mimeType: requiredString(value.mimeType),
    reviewNote: stringOrNull(value.reviewNote),
    reviewedAt: stringOrNull(value.reviewedAt),
    status: privateDocumentStatus(value.status),
    updatedAt: requiredString(value.uploadedAt),
    validationState: privateDocumentValidationState(value.validationState),
  };
}

export function mapTherapistSettingsUpdateResult(
  input: unknown,
): TherapistSettingsUpdateResult {
  const value = asObject(input);
  return {
    account: {
      displayName: stringOr(value.display_name, ""),
      phone: stringOr(value.phone, ""),
      identity: mapIdentity(value.identity),
    },
  };
}

function mapIdentity(value: unknown): TherapistPrivateIdentityFields {
  const identity = asObject(value);
  return {
    city: stringOr(identity.city, ""),
    complement: stringOr(identity.complement, ""),
    documentNumber: stringOr(identity.documentNumber, ""),
    documentType: documentType(identity.documentType),
    neighborhood: stringOr(identity.neighborhood, ""),
    postalCode: stringOr(identity.postalCode, ""),
    state: stringOr(identity.state, ""),
    street: stringOr(identity.street, ""),
    streetNumber: stringOr(identity.streetNumber, ""),
  };
}

function documentType(value: unknown): TherapistPrivateIdentityDocumentType {
  return value === "rg" || value === "passport" ? value : "cpf";
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function firstObject(value: unknown): JsonObject {
  if (Array.isArray(value)) return asObject(value[0]);
  return asObject(value);
}

function requiredString(value: unknown) {
  if (typeof value !== "string" || !value) {
    throw new Error("Invalid therapist settings contract.");
  }
  return value;
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function privateDocumentKind(value: unknown): TherapistPrivateDocumentKind {
  if (value === "address_proof" || value === "identity_document") return value;
  throw new Error("Invalid therapist private document kind.");
}

function privateDocumentStatus(value: unknown): TherapistPrivateDocumentStatus {
  if (
    value === "accepted" ||
    value === "archived" ||
    value === "rejected" ||
    value === "uploaded"
  ) {
    return value;
  }
  throw new Error("Invalid therapist private document status.");
}

function privateDocumentValidationState(
  value: unknown,
): TherapistPrivateDocumentValidationState {
  if (
    value === "failed" ||
    value === "not_scanned" ||
    value === "passed" ||
    value === "pending"
  ) {
    return value;
  }
  throw new Error("Invalid therapist private document validation state.");
}

function verificationStatus(
  value: unknown,
): TherapistProfileVerificationStatus {
  if (
    value === "approved" ||
    value === "changes_requested" ||
    value === "draft" ||
    value === "in_review" ||
    value === "none" ||
    value === "rejected" ||
    value === "submitted" ||
    value === "suspended"
  ) {
    return value;
  }
  return "draft";
}

function plan(value: unknown): TherapistPlan {
  return value === "premium" || value === "premium_plus" ? value : "free";
}

function status(value: unknown): TherapistStatus {
  if (
    value === "approved" ||
    value === "changes_requested" ||
    value === "draft" ||
    value === "in_review" ||
    value === "rejected" ||
    value === "submitted" ||
    value === "suspended"
  ) {
    return value;
  }
  return "draft";
}
