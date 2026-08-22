import "server-only";

import { TherapistStatus } from "@/domain/tes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export type TherapistSessionSummary = {
  displayName: string;
};

type SupabaseUserResponse = {
  email?: string | null;
  id?: string;
};

type ProfileRow = {
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type TherapistProfileRow = {
  public_name: string | null;
  status: string | null;
};

export async function getTherapistSessionSummary(
  accessToken: string | null | undefined,
): Promise<TherapistSessionSummary | null> {
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
      `${config.url}/rest/v1/profiles?select=display_name,email,role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
      config.apiKey,
      accessToken,
    );
    const [therapistProfile] = await requestSupabase<TherapistProfileRow[]>(
      `${config.url}/rest/v1/therapist_profiles?select=public_name,status&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      config.apiKey,
      accessToken,
    );

    if (
      profile?.role !== "therapist" ||
      !therapistProfile ||
      therapistProfile.status === TherapistStatus.Rejected ||
      therapistProfile.status === TherapistStatus.Suspended
    ) {
      return null;
    }

    return {
      displayName:
        therapistProfile.public_name?.trim() ||
        profile.display_name?.trim() ||
        user.email?.split("@")[0] ||
        "Terapeuta TES",
    };
  } catch {
    return null;
  }
}

export async function logoutTherapistSession(
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
    throw new Error("Failed to read therapist session summary.");
  }

  return (await response.json()) as T;
}
