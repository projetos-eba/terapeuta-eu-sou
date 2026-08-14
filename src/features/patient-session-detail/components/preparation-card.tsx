import { CheckCircle2 } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function PreparationCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  const { preparation } = data.encounterState;

  return (
    <section className="grid gap-6 border-t border-border pt-8">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-primary sm:text-xs">
          Antes do encontro
        </p>
        <h2 className="mt-3 font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
          {preparation.title}
        </h2>
      </div>

      <div className="rounded-[28px] border border-border bg-white/80 p-5 sm:p-6">
        <p className="text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Use este tempo para chegar ao encontro com mais calma, privacidade e
          estabilidade.
        </p>
        <ul className="mt-5 space-y-3">
          {preparation.checklist.map((item) => (
            <li
              className="flex gap-3 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base"
              key={item}
            >
              <CheckCircle2
                aria-hidden="true"
                className="mt-1 shrink-0 text-brand-primary"
                size={16}
              />
              {item}
            </li>
          ))}
        </ul>

        {preparation.countdownLabel ? (
          <p className="mt-5 border-t border-border pt-4 text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
            {preparation.countdownLabel}
          </p>
        ) : null}
      </div>
    </section>
  );
}
