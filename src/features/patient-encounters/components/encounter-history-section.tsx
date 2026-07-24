import type { PatientEncounter } from "../patient-encounters.types";
import { EncounterRow } from "./encounter-row";

export function EncounterHistorySection({
  encounters,
}: {
  encounters: PatientEncounter[];
}) {
  return (
    <section
      aria-labelledby="patient-history-encounters-title"
      className="rounded-card border border-brand-lavender bg-white p-5 shadow-card md:p-7"
    >
      <h2
        id="patient-history-encounters-title"
        className="font-display text-3xl font-light italic text-brand-deep md:text-4xl"
      >
        Histórico de encontros
      </h2>
      <p className="mt-2 text-sm font-semibold text-tesText-secondary">
        Revisite suas experiências anteriores.
      </p>

      {encounters.length > 0 ? (
        <div className="mt-6 divide-y divide-brand-lavender/70">
          {encounters.map((encounter) => (
            <EncounterRow encounter={encounter} key={encounter.id} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-card border border-dashed border-brand-lavender bg-surface-soft p-6 text-center">
          <p className="text-sm font-extrabold text-brand-deep">
            Seu histórico aparecerá aqui depois dos encontros realizados.
          </p>
        </div>
      )}
    </section>
  );
}
