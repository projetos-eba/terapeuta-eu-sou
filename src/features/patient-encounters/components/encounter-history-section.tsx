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
      className="border-t border-border pt-7 sm:pt-8"
    >
      <div className="max-w-[720px]">
        <h2
          className="font-display text-[1.8rem] font-light italic leading-tight text-brand-deep sm:text-[2.1rem]"
          id="patient-history-encounters-title"
        >
          Encontros anteriores
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Retome detalhes, resumos e ações disponíveis sem perder o contexto.
        </p>
      </div>

      {encounters.length > 0 ? (
        <div className="mt-5 divide-y divide-border border-y border-border">
          {encounters.map((encounter) => (
            <EncounterRow encounter={encounter} key={encounter.id} />
          ))}
        </div>
      ) : (
        <p className="mt-5 max-w-[620px] text-sm font-semibold leading-6 text-tesText-muted">
          Seu histórico aparecerá aqui depois dos encontros realizados.
        </p>
      )}
    </section>
  );
}
