import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { BrainCog, Calendar, Star } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function TherapistJourneyCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  return (
    <section className="rounded-card border border-brand-lavender bg-brand-lavenderSoft p-6 shadow-card">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <div className="flex gap-5">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full">
            {data.therapist.avatarUrl ? (
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="80px"
                src={data.therapist.avatarUrl}
              />
            ) : (
              <span className="grid size-full place-items-center bg-white text-2xl font-extrabold text-brand-primary">
                {data.therapist.name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <h2 className="font-display text-3xl font-light italic text-brand-deep">
              Sua jornada com {data.journey.therapistName.split(" ")[0]}
            </h2>
            <p className="mt-2 text-sm font-semibold text-tesText-secondary">
              Acompanhe sua caminhada de evolução.
            </p>
            <Link
              className="mt-4 inline-flex text-sm font-extrabold text-brand-primary transition hover:text-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={data.therapist.profileHref as Route<string>}
            >
              Ver perfil da terapeuta ›
            </Link>
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <JourneyFact
            icon={Calendar}
            label="Encontros realizados"
            value={String(data.journey.completedEncountersCount)}
          />
          <JourneyFact
            icon={Star}
            label="Início da jornada"
            value={data.journey.startedAtLabel}
          />
          <JourneyFact
            icon={BrainCog}
            label="Último tema explorado"
            value={data.journey.lastExploredTopic}
          />
        </dl>
      </div>
    </section>
  );
}

function JourneyFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <Icon aria-hidden="true" className="mx-auto text-brand-primary" size={22} />
      <dt className="mt-2 text-sm font-extrabold text-brand-deep">{value}</dt>
      <dd className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
        {label}
      </dd>
    </div>
  );
}
