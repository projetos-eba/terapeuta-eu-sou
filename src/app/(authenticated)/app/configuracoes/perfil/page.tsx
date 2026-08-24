import { PatientAccountPage, getPatientAccount } from "@/features/patient-account";
import { requirePatientSession } from "@/lib/auth/patient-session";

export default async function PatientAccountRoutePage() {
  const session = await requirePatientSession();

  try {
    const data = await getPatientAccount(session.profileId, session.accessToken);
    return <PatientAccountPage data={data} />;
  } catch {
    return (
      <section className="mx-auto grid max-w-[830px] gap-5 rounded-card border border-[var(--tes-color-border)] bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          !
        </span>
        <div>
          <h1 className="font-display text-3xl font-light italic text-brand-deep sm:text-4xl">
            Não foi possível carregar sua conta.
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
            Atualize a página em alguns instantes. Se o problema continuar,
            fale com o suporte.
          </p>
        </div>
      </section>
    );
  }
}
