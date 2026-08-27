import {
  PatientEncountersPage,
  getPatientEncountersPage,
} from "@/features/patient-encounters";
import { requirePatientSession } from "@/lib/auth/patient-session";

export default async function PatientEncountersRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePatientSession();
  const params = searchParams ? await searchParams : {};
  const requestedBooking = firstString(
    params.feedback ?? params.avaliar ?? params.review,
  );

  try {
    const data = await getPatientEncountersPage(
      session.profileId,
      session.accessToken,
    );

    return (
      <PatientEncountersPage
        data={data}
        initialFeedbackBookingId={requestedBooking}
      />
    );
  } catch {
    return (
      <main className="mx-auto grid w-full max-w-[840px] gap-4 pb-12 pt-8 text-tesText-primary">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-primary sm:text-xs">
          Encontros
        </p>
        <h1 className="max-w-[680px] font-display text-[2.2rem] font-light italic leading-tight text-brand-deep sm:text-[2.7rem]">
          Não foi possível carregar seus encontros.
        </h1>
        <p className="max-w-[620px] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Atualize a página em alguns instantes ou acione o suporte se o
          problema continuar.
        </p>
      </main>
    );
  }
}

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
