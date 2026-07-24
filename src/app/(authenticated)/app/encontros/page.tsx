import {
  PatientEncountersPage,
  getPatientEncountersPage,
} from "@/features/patient-encounters";
import { requirePatientSession } from "@/lib/auth/patient-session";

export default async function PatientEncountersRoute() {
  const session = await requirePatientSession();

  try {
    const data = await getPatientEncountersPage(
      session.profileId,
      session.accessToken,
    );

    return <PatientEncountersPage data={data} />;
  } catch {
    return (
      <main className="mx-auto max-w-[830px] rounded-card border border-brand-lavender bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-3xl font-light italic text-brand-deep">
          Não foi possível carregar seus encontros.
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          Atualize a página em alguns instantes ou acione o suporte se o
          problema continuar.
        </p>
      </main>
    );
  }
}
