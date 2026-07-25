import { SupabaseRestClient } from "./supabase-rest.ts";
import { normalizeEmail } from "../email/validation.ts";
import type { UserRole } from "../email/types.ts";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  email_confirmed_at?: string | null;
  role: UserRole;
};

export type AuthUserRow = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
};

type TherapistProfileSignupRow = {
  metadata?: unknown;
};

export async function findProfileByEmail(
  client: SupabaseRestClient,
  email: string,
) {
  const normalized = normalizeEmail(email);
  const rows = await client.get<ProfileRow[]>(
    `/rest/v1/profiles?select=id,display_name,email,email_confirmed_at,role&email=eq.${
      encodeURIComponent(
        normalized,
      )
    }&limit=1`,
  );

  return rows[0] ?? null;
}

export async function getProfileById(
  client: SupabaseRestClient,
  userId: string,
) {
  const rows = await client.get<ProfileRow[]>(
    `/rest/v1/profiles?select=id,display_name,email,email_confirmed_at,role&id=eq.${
      encodeURIComponent(
        userId,
      )
    }&limit=1`,
  );

  return rows[0] ?? null;
}

export async function getAuthUser(client: SupabaseRestClient, userId: string) {
  return client.get<AuthUserRow>(`/auth/v1/admin/users/${userId}`);
}

export async function confirmAuthUserEmail(
  client: SupabaseRestClient,
  userId: string,
) {
  const user = await client.put<AuthUserRow>(`/auth/v1/admin/users/${userId}`, {
    email_confirm: true,
  });

  await client.patch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    { email_confirmed_at: new Date().toISOString() },
    "return=minimal",
  );

  return user;
}

export async function updateAuthUserPassword(
  client: SupabaseRestClient,
  userId: string,
  password: string,
) {
  return client.put<AuthUserRow>(`/auth/v1/admin/users/${userId}`, {
    password,
  });
}

export function redirectForRole(role: UserRole, suffix: string) {
  if (role === "therapist") {
    return `/terapeuta/login${suffix}`;
  }

  return `/cliente/login${suffix}`;
}

export async function redirectAfterEmailConfirmation(
  client: SupabaseRestClient,
  role: UserRole,
  userId: string,
  suffix: string,
) {
  const baseRedirect = redirectForRole(role, suffix);

  if (role !== "therapist") {
    return baseRedirect;
  }

  const requestedPlan = await getTherapistRequestedPaidPlan(client, userId);

  if (!requestedPlan) {
    return baseRedirect;
  }

  const separator = baseRedirect.includes("?") ? "&" : "?";
  const continuation = `/terapeuta/checkout?plan=${requestedPlan}`;

  return `${baseRedirect}${separator}next=${encodeURIComponent(continuation)}`;
}

async function getTherapistRequestedPaidPlan(
  client: SupabaseRestClient,
  userId: string,
) {
  const rows = await client.get<TherapistProfileSignupRow[]>(
    `/rest/v1/therapist_profiles?select=metadata&user_id=eq.${
      encodeURIComponent(
        userId,
      )
    }&limit=1`,
  );
  const requestedPlan = getRequestedPlanFromMetadata(rows[0]?.metadata);

  return requestedPlan === "premium" || requestedPlan === "premium_plus"
    ? requestedPlan
    : null;
}

function getRequestedPlanFromMetadata(metadata: unknown) {
  if (!isRecord(metadata) || !isRecord(metadata.signup)) {
    return null;
  }

  return typeof metadata.signup.requestedPlan === "string"
    ? metadata.signup.requestedPlan
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
