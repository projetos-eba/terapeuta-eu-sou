import { Leaf } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function SessionAboutCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  return (
    <section className="grid gap-6 border-t border-border pt-8">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Leaf aria-hidden="true" size={20} />
        </span>
        <h2 className="font-display text-[1.85rem] font-light italic leading-none text-brand-deep sm:text-[2.1rem]">
          Sobre este encontro
        </h2>
      </div>

      <div className="grid gap-6 rounded-[28px] border border-border bg-white/80 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
            Contexto principal
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
            Este encontro foi agendado para cuidar de{" "}
            <span className="font-extrabold text-brand-deep">
              {data.intake.focusArea}
            </span>
            . Você vai seguir esse cuidado com o apoio de{" "}
            <span className="font-extrabold text-brand-deep">
              {data.therapist.name}
            </span>
            .
          </p>
        </div>

        <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
              Objetivo da terapia
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
              {data.service.objective}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
              Continuidade
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
              Este será o encontro número{" "}
              <span className="font-extrabold text-brand-deep">
                {data.journey.completedEncountersCount + 1}
              </span>{" "}
              com {data.therapist.name}.
            </p>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
              Acompanhamento desde {data.journey.startedAtLabel}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
