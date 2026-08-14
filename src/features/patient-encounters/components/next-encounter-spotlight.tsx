import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import { TESButton } from "@/components/tes/tes-button";
import { routes } from "@/lib/routes";

import {
  getEncounterGuidance,
  getSpotlightEyebrow,
} from "../patient-encounters.copy";
import type { PatientEncounter } from "../patient-encounters.types";
import { EncounterStatusBadge } from "./encounter-status-badge";

export function NextEncounterSpotlight({
  encounter,
}: {
  encounter: PatientEncounter | null;
}) {
  if (!encounter) {
    return (
      <section
        aria-labelledby="patient-next-encounter-title"
        className="rounded-card bg-surface-soft px-5 py-7 sm:px-8 sm:py-9"
      >
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-primary sm:text-xs">
          {getSpotlightEyebrow(null)}
        </p>
        <h2
          className="mt-3 max-w-[680px] font-display text-[2rem] font-light italic leading-tight text-brand-deep sm:text-[2.4rem]"
          id="patient-next-encounter-title"
        >
          Você ainda não tem encontros agendados.
        </h2>
        <p className="mt-3 max-w-[680px] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Faça o Match TES para receber uma orientação inicial ou explore os
          profissionais disponíveis no seu tempo.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <TESButton href={routes.public.journey}>
            Fazer meu Match TES
          </TESButton>
          <TESButton href={routes.public.therapists} variant="secondary">
            Explorar terapeutas
          </TESButton>
        </div>
      </section>
    );
  }

  const guidance = getEncounterGuidance(encounter);

  return (
    <section
      aria-labelledby="patient-next-encounter-title"
      className="rounded-card bg-brand-lavenderSoft px-5 py-6 sm:px-8 sm:py-8"
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)] lg:items-end">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-primary sm:text-xs">
            {getSpotlightEyebrow(encounter)}
          </p>
          <h2
            className="mt-3 font-display text-[2.4rem] font-light italic leading-none text-brand-deep sm:text-[3rem]"
            id="patient-next-encounter-title"
          >
            {encounter.dateLabel}
          </h2>
          <p className="mt-2 text-lg font-extrabold text-brand-deep sm:text-xl">
            {encounter.scheduleLabel}
          </p>

          <div className="mt-6 flex min-w-0 items-center gap-4 border-t border-border pt-5">
            <Avatar
              name={encounter.therapist.name}
              src={encounter.therapist.avatarUrl}
            />
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold text-brand-deep">
                {encounter.therapist.name}
              </h3>
              <p className="mt-1 text-sm font-bold leading-6 text-tesText-secondary">
                {encounter.serviceLabel}
              </p>
              <p className="text-[11px] font-semibold leading-5 text-tesText-muted sm:text-xs">
                {encounter.therapyLabel} · {encounter.approachLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <EncounterStatusBadge status={encounter.status}>
            {encounter.statusLabel}
          </EncounterStatusBadge>
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
            {guidance}
          </p>
          <div className="mt-5">
            {encounter.primaryAction.disabled ? (
              <button
                className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-full bg-white/70 px-5 text-sm font-extrabold text-tesText-secondary sm:w-auto"
                disabled
                title={encounter.primaryAction.reason}
                type="button"
              >
                {encounter.primaryAction.label}
              </button>
            ) : (
              <TESButton
                className="w-full sm:w-auto"
                href={encounter.primaryAction.href}
              >
                {encounter.primaryAction.label}
              </TESButton>
            )}
          </div>
          {encounter.primaryAction.label !== "Ver detalhes" ? (
            <Link
              className="mt-3 inline-flex min-h-11 items-center text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={
                routes.patient.encounterDetail(encounter.id) as Route<string>
              }
            >
              Ver detalhes do encontro
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      <Image
        alt=""
        className="size-16 shrink-0 rounded-full object-cover"
        height={64}
        src={src}
        width={64}
      />
    );
  }

  return (
    <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white text-lg font-extrabold text-brand-primary">
      {name.charAt(0)}
    </span>
  );
}
