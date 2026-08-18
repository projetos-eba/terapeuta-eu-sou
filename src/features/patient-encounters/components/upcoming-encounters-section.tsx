import type { PatientEncounter } from "../patient-encounters.types";
import { EncounterRow } from "./encounter-row";

export function UpcomingEncountersSection({
  encounters,
}: {
  encounters: PatientEncounter[];
}) {
  return (
    <section aria-labelledby="patient-upcoming-encounters-title">
      <div className="max-w-[720px]">
        <h2
          className="font-display text-[1.9rem] font-light italic leading-tight text-brand-deep sm:text-[2.2rem]"
          id="patient-upcoming-encounters-title"
        >
          Próximos encontros
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Seus próximos passos na jornada.
        </p>
      </div>

      <div className="mt-5 divide-y divide-border border-y border-border">
        {encounters.map((encounter) => (
          <EncounterRow encounter={encounter} key={encounter.id} />
        ))}
      </div>
    </section>
  );
}
