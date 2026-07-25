import { Leaf } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function SessionAboutCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  return (
    <section className="relative min-h-[360px] overflow-hidden rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Leaf aria-hidden="true" size={24} />
        </span>
        <h2 className="font-display text-2xl font-light italic text-brand-deep">
          Sobre este encontro
        </h2>
      </div>
      <p className="mt-8 text-sm font-semibold leading-6 text-tesText-secondary">
        Você agendou este encontro para continuar seu processo de{" "}
        <strong className="font-extrabold text-brand-deep">
          {data.intake.focusArea}.
        </strong>
      </p>
      <h3 className="mt-10 text-base font-extrabold text-brand-deep">
        Objetivo da terapia
      </h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {data.service.objective}
      </p>
    </section>
  );
}
