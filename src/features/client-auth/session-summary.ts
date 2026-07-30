import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export type ClientSessionSummary = {
  avatarUrl: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  timezone: string;
};

type SupabaseUserResponse = {
  email?: string | null;
  id?: string;
};

type ProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

type PatientProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  phone: string | null;
  timezone: string | null;
};

export async function getClientSessionSummary(
  accessToken: string | null | undefined,
): Promise<ClientSessionSummary | null> {
  const config = getSupabasePublicConfig();

  if (!config || !accessToken) return null;

  try {
    const user = await requestSupabase<SupabaseUserResponse>(
      `${config.url}/auth/v1/user`,
      config.apiKey,
      accessToken,
    );

    if (!user.id) return null;

    const [profile] = await requestSupabase<ProfileRow[]>(
      `${config.url}/rest/v1/profiles?select=display_name,email,phone,avatar_url,role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
      config.apiKey,
      accessToken,
    );

    if (profile?.role !== "patient") return null;

    const [patientProfile] = await requestSupabase<PatientProfileRow[]>(
      `${config.url}/rest/v1/patient_profiles?select=display_name,phone,avatar_url,timezone&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      config.apiKey,
      accessToken,
    );

    return {
      avatarUrl: patientProfile?.avatar_url ?? profile.avatar_url ?? null,
      displayName:
        patientProfile?.display_name ??
        profile.display_name ??
        user.email?.split("@")[0] ??
        "Cliente TES",
      email: profile.email ?? user.email ?? null,
      phone: patientProfile?.phone ?? profile.phone ?? null,
      timezone: patientProfile?.timezone ?? "America/Sao_Paulo",
    };
  } catch {
    return null;
  }
}

export async function logoutClientSession(
  accessToken: string | null | undefined,
) {
  const config = getSupabasePublicConfig();

  if (!config || !accessToken) return;

  try {
    await fetch(`${config.url}/auth/v1/logout`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: config.apiKey,
      },
      method: "POST",
    });
  } catch {
    // Logout remains best-effort because local cookies are cleared by the route.
  }
}

async function requestSupabase<T>(
  url: string,
  apiKey: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: apiKey,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to read client session summary.");
  }

  return (await response.json()) as T;
}
