import type { TherapistPlan, TherapistStatus } from "@/domain/tes";
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
