import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

const DEMO_PROFILE_ID = "90000000-0000-4000-8000-000000000001";

type SupabaseAuthUser = {
  id: string;
};

type PatientProfile = {
  display_name: string | null;
  id: string;
  role: "admin" | "patient" | "therapist";
};

export type AuthenticatedPatientSession = {
  profileId: string;
};

export async function requirePatientSession(): Promise<AuthenticatedPatientSession> {
  const accessToken = cookies().get("tes_patient_access_token")?.value;
  const config = getSupabaseAuthConfig();

  if (!config) {
    if (process.env.NODE_ENV === "development") {
      return { profileId: DEMO_PROFILE_ID };
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

    return { profileId: profile.id };
  } catch {
    redirect(routes.public.clientSignIn);
  }
}

export function getPatientAccessToken() {
  return cookies().get("tes_patient_access_token")?.value ?? null;
}

export function getSupabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return { anonKey, url: url.replace(/\/$/, "") };
}

async function requestSupabase<T>(
  config: NonNullable<ReturnType<typeof getSupabaseAuthConfig>>,
  path: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error("Patient session is invalid");

  return (await response.json()) as T;
}
