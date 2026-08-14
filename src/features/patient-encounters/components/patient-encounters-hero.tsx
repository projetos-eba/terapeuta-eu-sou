import type { PatientEncountersPatient } from "../patient-encounters.types";

export function PatientEncountersHero({
  patient,
}: {
  patient: PatientEncountersPatient;
}) {
  return (
    <header
      aria-labelledby="patient-encounters-page-title"
      className="grid gap-3 pt-2 sm:pt-4"
    >
      <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-brand-primary sm:text-xs">
        Encontros
      </p>
      <h1
        className="max-w-[760px] font-display text-[2.3rem] font-light italic leading-none text-brand-deep sm:text-[2.8rem] lg:text-[3.2rem]"
        id="patient-encounters-page-title"
      >
        Seus encontros, com clareza.
      </h1>
      <p className="max-w-[720px] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
        {patient.name}, veja o que vem a seguir, o que precisa da sua atenção e
        retome encontros anteriores quando precisar.
      </p>
    </header>
  );
}
