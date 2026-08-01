import { revalidatePath } from "next/cache";

import {
  getPatientFavoriteTherapistsPage,
  PatientFavoriteTherapistsPage,
} from "@/features/patient-favorites";
import {
  getSupabaseServerRestConfig,
  supabaseServerRestRequest,
} from "@/lib/supabase/server-rest";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { routes } from "@/lib/routes";

export default async function PatientFavoriteTherapistsRoute() {
  const session = await requirePatientSession();

  try {
    const data = await getPatientFavoriteTherapistsPage(
      session.profileId,
      session.accessToken,
    );

    return (
      <PatientFavoriteTherapistsPage
        data={data}
        removeFavoriteAction={removeFavoriteTherapist}
      />
    );
  } catch {
    return (
      <main className="mx-auto max-w-[830px] rounded-card border border-brand-lavender bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-3xl font-light italic text-brand-deep">
          Não foi possível carregar seus favoritos.
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          Atualize a página em alguns instantes ou acione o suporte se o
          problema continuar.
        </p>
      </main>
    );
  }
}

async function removeFavoriteTherapist(therapistProfileId: string) {
  "use server";

  const session = await requirePatientSession();
  const config = getSupabaseServerRestConfig(session.accessToken);

  if (!config) return;

  const patientProfiles = await supabaseServerRestRequest<{ id: string }[]>(
    config,
    `/rest/v1/patient_profiles?select=id&user_id=eq.${encodeURIComponent(session.profileId)}&limit=1`,
  );
  const patientProfile = patientProfiles[0];

  if (!patientProfile) return;

  await fetch(
    `${config.url}/rest/v1/favorite_therapists?patient_profile_id=eq.${patientProfile.id}&therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}`,
    {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.accessToken}`,
      },
      method: "DELETE",
    },
  );

  revalidatePath(routes.patient.favoriteTherapists);
  revalidatePath(routes.patient.home);
}
