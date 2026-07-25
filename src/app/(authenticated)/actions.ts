"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getPatientAccessToken,
  getSupabaseAuthConfig,
  requirePatientSession,
} from "@/lib/auth/patient-session";
import { routes } from "@/lib/routes";
import {
  getPatientOverview,
  savePatientMoodCheckin,
  type MoodKey,
} from "@/features/patient-overview";

export async function logoutPatient() {
  const accessToken = getPatientAccessToken();
  const config = getSupabaseAuthConfig();

  if (accessToken && config) {
    await fetch(`${config.url}/auth/v1/logout`, {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
    }).catch(() => undefined);
  }

  cookies().delete("tes_patient_access_token");
  cookies().delete("tes_patient_refresh_token");
  redirect(routes.public.clientSignIn);
}

export async function savePatientMood(mood: MoodKey) {
  const session = await requirePatientSession();
  const overview = await getPatientOverview(
    session.profileId,
    session.accessToken,
  );

  await savePatientMoodCheckin({
    accessToken: session.accessToken,
    mood,
    patientProfileId: overview.patient.patientProfileId,
  });
}
