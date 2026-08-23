import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export class TherapistSettingsQueryError extends Error {
  code: "forbidden" | "unavailable";

  constructor(code: "forbidden" | "unavailable") {
    super(code);
    this.name = "TherapistSettingsQueryError";
    this.code = code;
  }
}

export async function queryTherapistSettings({
  accessToken,
  userId,
}: {
  accessToken: string;
  userId: string;
}) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistSettingsQueryError("unavailable");

  const query = new URLSearchParams({
    id: `eq.${userId}`,
    limit: "1",
    select:
      "id,displayName:display_name,email,phone,therapistProfile:therapist_profiles!therapist_profiles_user_id_fkey(id,slug,publicName:public_name,plan,status,isPublic:is_public,isAcceptingBookings:is_accepting_bookings,publicStatus:public_status)",
  });

  const response = await fetch(`${config.url}/rest/v1/profiles?${query}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new TherapistSettingsQueryError("forbidden");
  }
  if (!response.ok) throw new TherapistSettingsQueryError("unavailable");

  const rows = (await response.json()) as unknown[];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new TherapistSettingsQueryError("forbidden");

  const profileValue = row.therapistProfile;
  const profile = Array.isArray(profileValue)
    ? (profileValue[0] as Record<string, unknown> | undefined)
    : (profileValue as Record<string, unknown> | undefined);
  const [identity, documentCenter] = await Promise.all([
    profile?.id ? fetchPrivateIdentity({ accessToken, config }) : {},
    profile?.id
      ? fetchPrivateDocumentCenter({ accessToken, config })
      : { documents: [], verificationStatus: "draft" },
  ]);

  return { ...row, documentCenter, identity };
}

export async function updateTherapistAccountSettings({
  accessToken,
  displayName,
  identity,
  phone,
  userId,
}: {
  accessToken: string;
  displayName: string;
  identity?: {
    city: string;
    complement: string;
    documentNumber: string;
    documentType: "cpf" | "rg" | "passport";
    neighborhood: string;
    postalCode: string;
    state: string;
    street: string;
    streetNumber: string;
  };
  phone: string;
  userId: string;
}) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistSettingsQueryError("unavailable");

  const query = new URLSearchParams({
    id: `eq.${userId}`,
    role: "eq.therapist",
    select: "display_name,phone",
  });
  const response = await fetch(`${config.url}/rest/v1/profiles?${query}`, {
    body: JSON.stringify({
      display_name: displayName,
      phone: phone || null,
    }),
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    method: "PATCH",
  });

  if (response.status === 401 || response.status === 403) {
    throw new TherapistSettingsQueryError("forbidden");
  }
  if (!response.ok) throw new TherapistSettingsQueryError("unavailable");

  const rows = (await response.json()) as unknown[];
  const row = rows[0];
  if (!row) throw new TherapistSettingsQueryError("forbidden");

  if (identity) {
    const identityResponse = await fetch(
      `${config.url}/rest/v1/rpc/save_therapist_private_identity_v1`,
      {
        body: JSON.stringify({
          p_city: identity.city,
          p_complement: identity.complement || null,
          p_country: "BR",
          p_document_number: identity.documentNumber,
          p_document_type: identity.documentType,
          p_neighborhood: identity.neighborhood,
          p_postal_code: identity.postalCode,
          p_state: identity.state,
          p_street: identity.street,
          p_street_number: identity.streetNumber,
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    if (!identityResponse.ok) {
      throw new TherapistSettingsQueryError(
        identityResponse.status === 401 || identityResponse.status === 403
          ? "forbidden"
          : "unavailable",
      );
    }

    const savedIdentity = await identityResponse.json().catch(() => ({}));
    return { ...row, identity: savedIdentity };
  }

  return { ...row, identity: {} };
}

async function fetchPrivateIdentity({
  accessToken,
  config,
}: {
  accessToken: string;
  config: { apiKey: string; url: string };
}) {
  const response = await fetch(
    `${config.url}/rest/v1/rpc/get_therapist_private_identity_v1`,
    {
      body: "{}",
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new TherapistSettingsQueryError(
      response.status === 401 || response.status === 403
        ? "forbidden"
        : "unavailable",
    );
  }

  return (await response.json().catch(() => ({}))) as unknown;
}

async function fetchPrivateDocumentCenter({
  accessToken,
  config,
}: {
  accessToken: string;
  config: { apiKey: string; url: string };
}) {
  const response = await fetch(
    `${config.url}/functions/v1/therapist-private-documents`,
    {
      body: JSON.stringify({ action: "therapist.read" }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new TherapistSettingsQueryError("forbidden");
  }
  if (!response.ok) {
    throw new TherapistSettingsQueryError("unavailable");
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { documentCenter?: unknown } | unknown;
    ok?: boolean;
  } | null;

  const data = payload?.data;
  const documentCenter =
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "documentCenter" in data
      ? data.documentCenter
      : data;

  if (!payload?.ok || !documentCenter) {
    throw new TherapistSettingsQueryError("unavailable");
  }

  return documentCenter;
}
