import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const DEMO_PROFILE_ID = "90000000-0000-4000-8000-000000000001";

type SupabaseAuthUser = {
  email?: string | null;
  id: string;
};

type PatientProfile = {
  display_name: string | null;
  id: string;
  role: "admin" | "patient" | "therapist";
};

export type AuthenticatedPatientSession = {
  accessToken: string | null;
  email: string | null;
  profileId: string;
};

export async function requirePatientSession(): Promise<AuthenticatedPatientSession> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_patient_access_token")?.value;
  const config = getSupabaseAuthConfig();

  if (!config) {
    if (process.env.NODE_ENV === "development") {
      return { accessToken: null, email: null, profileId: DEMO_PROFILE_ID };
    }

    redirect(routes.public.clientSignIn);
  }

  if (!accessToken) redirect(routes.public.clientSignIn);

  try {
    const user = await requestSupabase<SupabaseAuthUser>(
      config,
      "/auth/v1/user",
      accessToken,
    );
    const profiles = await requestSupabase<PatientProfile[]>(
      config,
      `/rest/v1/profiles?select=id,display_name,role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
      accessToken,
    );
    const profile = profiles[0];

    if (!profile || profile.role !== "patient") {
      redirect(routes.public.clientSignIn);
    }

    return { accessToken, email: user.email ?? null, profileId: profile.id };
  } catch {
    redirect(routes.public.clientSignIn);
  }
}

export async function getPatientAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("tes_patient_access_token")?.value ?? null;
}

export function getSupabaseAuthConfig() {
  const config = getSupabasePublicConfig();

  if (!config) return null;

  return config;
}

async function requestSupabase<T>(
  config: NonNullable<ReturnType<typeof getSupabaseAuthConfig>>,
  path: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error("Patient session is invalid");

  return (await response.json()) as T;
}
