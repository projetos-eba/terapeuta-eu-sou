import { Heart } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function SharedIntakeCard({
  intake,
}: {
  intake: PatientSessionDetailPageData["intake"];
}) {
  return (
    <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          <Heart aria-hidden="true" size={24} />
        </span>
        <h2 className="font-display text-2xl font-light italic leading-tight text-brand-deep">
          O que você compartilhou ao agendar
        </h2>
      </div>
      <p className="mt-8 text-sm font-semibold leading-6 text-tesText-secondary">
        Na hora do agendamento, você compartilhou que gostaria de falar sobre:
      </p>
      <blockquote className="mt-6 font-display text-2xl font-light italic leading-8 text-brand-primary">
        “{intake.sharedNote}”
      </blockquote>
      <button
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg border border-brand-lavender px-6 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        type="button"
      >
        Ver detalhes
      </button>
    </section>
  );
}
