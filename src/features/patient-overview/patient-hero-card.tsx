import { TESDecorativeMedia } from "@/components/tes";
import { platformAssets } from "@/lib/platform-assets";

import type { PatientOverviewPatient } from "./patient-overview.types";

export function PatientHeroCard({
  patient,
}: {
  patient: PatientOverviewPatient;
}) {
  return (
    <section className="relative isolate min-h-[278px] overflow-hidden rounded-[var(--tes-radius-auth-card)] bg-white">
      <TESDecorativeMedia
        className="absolute inset-y-0 right-0 hidden w-[56%] sm:block"
        fade="left"
        objectPosition="right center"
        priority
        sizes="(max-width: 1024px) 52vw, 465px"
        src={platformAssets.patientOverviewHero.src}
      />
      <div className="relative z-10 flex min-h-[278px] max-w-[390px] flex-col justify-center px-7 py-9 sm:px-[52px]">
        <h1 className="font-display text-[42px] font-light italic leading-none text-[var(--tes-color-primary-dark)] sm:text-[50px]">
          Olá,{" "}
          <span className="font-semibold text-[var(--tes-color-accent-cyan)]">
            {patient.name}.
          </span>
        </h1>
        <p className="mt-5 max-w-[290px] text-sm font-medium leading-6 text-[#6e6799]">
          Aqui você pode acompanhar sua jornada, encontrar novos caminhos e
          cuidar do que é importante para você neste momento.
        </p>
      </div>
    </section>
  );
}
