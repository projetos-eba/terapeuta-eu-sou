import {
  PatientOverviewPage,
  getPatientOverview,
} from "@/features/patient-overview";
import { requirePatientSession } from "@/lib/auth/patient-session";

import { savePatientMood } from "../actions";

export default async function PatientHomePage() {
  const session = await requirePatientSession();

  try {
    const overview = await getPatientOverview(
      session.profileId,
      session.accessToken,
    );
    return (
      <PatientOverviewPage data={overview} onMoodChange={savePatientMood} />
    );
  } catch {
    return (
      <section className="mx-auto max-w-[830px] rounded-card border border-[var(--tes-color-border)] bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-3xl font-light italic text-[var(--tes-color-primary-dark)]">
          Não foi possível carregar sua visão geral.
        </h1>
        <p className="mt-3 text-sm text-[var(--tes-color-text-secondary-app)]">
          Atualize a página em alguns instantes ou acione o suporte se o
          problema continuar.
        </p>
      </section>
    );
  }
}
