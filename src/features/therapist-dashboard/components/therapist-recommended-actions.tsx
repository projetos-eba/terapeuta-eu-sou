import Link from "next/link";
import type { Route } from "next";
import { Circle } from "lucide-react";

import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function TherapistRecommendedActions({
  actions,
}: {
  actions: TherapistDashboardPageData["recommendedActions"];
}) {
  return (
    <section className="flex min-h-[330px] flex-col rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-6 shadow-card">
      <h2 className="text-xl font-bold text-brand-deep">Ações recomendadas</h2>
      {actions.length ? (
        <ul className="mt-6 space-y-5">
          {actions.slice(0, 3).map((action) => (
            <li className="flex gap-3" key={action.id}>
              <Circle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-brand-primary"
              />
              <div>
                <Link
                  className="text-sm font-bold text-brand-deep outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
                  href={action.href as Route<string>}
                >
                  {action.title}
                </Link>
                <p className="mt-1 text-xs leading-5 text-tesText-secondary">
                  {action.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm leading-6 text-tesText-secondary">
          Não há novas ações recomendadas para este período.
        </p>
      )}
      <Link
        className="mt-auto pt-8 text-center text-xs font-bold text-brand-deep outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.therapist.assessorIa as Route<string>}
      >
        Ver todas as recomendações →
      </Link>
    </section>
  );
}
