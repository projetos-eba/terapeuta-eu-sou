import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

import type { PatientEncounter } from "../patient-encounters.types";
import { EncounterRow } from "./encounter-row";

export function UpcomingEncountersSection({
  encounters,
}: {
  encounters: PatientEncounter[];
}) {
  return (
    <section
      aria-labelledby="patient-upcoming-encounters-title"
      className="rounded-card border border-brand-lavender bg-white p-5 shadow-card md:p-7"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2
            id="patient-upcoming-encounters-title"
            className="font-display text-3xl font-light italic text-brand-deep md:text-4xl"
          >
            Próximos encontros
          </h2>
          <p className="mt-2 text-sm font-semibold text-tesText-secondary">
            Seus próximos passos na jornada.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.public.therapists as Route<string>}
        >
          Explorar terapeutas
        </Link>
      </div>

      {encounters.length > 0 ? (
        <div className="mt-6 divide-y divide-brand-lavender/70">
          {encounters.map((encounter) => (
            <EncounterRow encounter={encounter} key={encounter.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          actionLabel="Explorar terapeutas"
          href={routes.public.therapists}
          title="Você ainda não tem encontros agendados."
        />
      )}
    </section>
  );
}

function EmptyState({
  actionLabel,
  href,
  title,
}: {
  actionLabel: string;
  href: string;
  title: string;
}) {
  return (
    <div className="mt-6 rounded-card border border-dashed border-brand-lavender bg-surface-soft p-6 text-center">
      <p className="text-sm font-extrabold text-brand-deep">{title}</p>
      <Link
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-extrabold text-brand-primary shadow-card transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={href as Route<string>}
      >
        {actionLabel}
      </Link>
    </div>
  );
}
