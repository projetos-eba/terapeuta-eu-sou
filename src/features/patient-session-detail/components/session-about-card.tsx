import Image from "next/image";
import { Leaf } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function SessionAboutCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  return (
    <section className="relative overflow-hidden rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Leaf aria-hidden="true" size={20} />
        </span>
        <h2 className="font-display text-[1.85rem] font-light italic leading-none text-brand-deep sm:text-[2.1rem]">
          Sobre este encontro
        </h2>
      </div>

      <div className="relative z-10 mt-6 grid max-w-[calc(100%-1rem)] gap-6 sm:max-w-[78%]">
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
      <Image
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -right-12 hidden w-52 opacity-85 sm:block lg:w-60"
        height={1254}
        src="/patient/encounters/lotus-detail.png"
        width={1254}
      />
    </section>
  );
}
