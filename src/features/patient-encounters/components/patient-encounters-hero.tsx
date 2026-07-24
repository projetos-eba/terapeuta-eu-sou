import Image from "next/image";

import type { PatientEncountersPatient } from "../patient-encounters.types";

export function PatientEncountersHero({
  patient,
}: {
  patient: PatientEncountersPatient;
}) {
  return (
    <section
      aria-label={`Encontros de ${patient.name}`}
      aria-labelledby="patient-encounters-hero-title"
      className="overflow-hidden rounded-card border border-brand-lavender bg-[linear-gradient(135deg,#FFFFFF_0%,#FBF8FF_56%,#F1ECFB_100%)] shadow-card"
    >
      <div className="grid min-h-[270px] gap-6 px-6 py-8 md:grid-cols-[minmax(0,1fr)_360px] md:items-center md:px-10 lg:px-12">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-brand-primary">
            Encontros
          </p>
          <h1
            id="patient-encounters-hero-title"
            className="mt-5 max-w-xl font-display text-4xl font-light italic leading-tight text-brand-deep md:text-5xl"
          >
            Seu espaço de acompanhamento
          </h1>
          <p className="mt-4 max-w-[540px] text-base font-semibold leading-7 text-tesText-secondary md:text-lg">
            Tudo o que faz parte da sua jornada reunido em um único lugar.
          </p>
        </div>
        <div className="relative min-h-[180px] overflow-hidden rounded-card bg-brand-lavenderSoft md:min-h-[220px]">
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes="(min-width: 1024px) 360px, 100vw"
            src="/home/tablet-video-session.png"
          />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0.12)_58%,rgba(108,61,145,0.2)_100%)]" />
        </div>
      </div>
    </section>
  );
}
