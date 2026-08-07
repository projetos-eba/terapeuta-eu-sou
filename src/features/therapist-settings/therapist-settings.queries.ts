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
  const row = rows[0];
  if (!row) throw new TherapistSettingsQueryError("forbidden");

  return row;
}

export async function updateTherapistAccountSettings({
  accessToken,
  displayName,
  phone,
  userId,
}: {
  accessToken: string;
  displayName: string;
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

  return row;
}
