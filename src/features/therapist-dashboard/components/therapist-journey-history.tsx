import Link from "next/link";
import type { Route } from "next";
import { CalendarCheck2, Star, UsersRound } from "lucide-react";

import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function TherapistJourneyHistory({
  history,
}: {
  history: TherapistDashboardPageData["history"];
}) {
  const items = [
    {
      icon: CalendarCheck2,
      label: "Sessões realizadas",
      value: history.completedSessions.toLocaleString("pt-BR"),
    },
    {
      icon: UsersRound,
      label: "Pessoas atendidas",
      value: history.activePatients.toLocaleString("pt-BR"),
    },
    {
      icon: Star,
      label: "Avaliação média",
      value:
        history.averageRating === null
          ? "—"
          : history.averageRating.toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            }),
    },
  ];

  return (
    <section className="flex min-h-[330px] flex-col rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-6 shadow-card">
      <h2 className="text-xl font-bold text-brand-deep">
        Histórico da Jornada
      </h2>
      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div className="flex items-start gap-3" key={label}>
            <span className="grid size-12 shrink-0 place-items-center rounded-md bg-brand-lavenderSoft text-brand-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span>
              <strong className="block text-2xl font-extrabold text-brand-deep">
                {value}
              </strong>
              <span className="block text-xs font-semibold text-tesText-secondary">
                {label}
              </span>
            </span>
          </div>
        ))}
      </div>
      <Link
        className="mt-auto pt-8 text-center text-xs font-bold text-brand-deep outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.therapist.patients as Route<string>}
      >
        Ver trajetória completa →
      </Link>
    </section>
  );
}
