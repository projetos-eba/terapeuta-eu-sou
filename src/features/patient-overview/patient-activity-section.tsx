import Link from "next/link";
import type { Route } from "next";

import { routes } from "@/lib/routes";

import { PatientActivityCard } from "./patient-activity-card";
import type { PatientActivitySummary } from "./patient-overview.types";

export function PatientActivitySection({
  activity,
}: {
  activity: PatientActivitySummary;
}) {
  const cards = [
    {
      description: `${activity.unreadMessagesCount} não ${activity.unreadMessagesCount === 1 ? "lida" : "lidas"}`,
      href: routes.patient.messages,
      kind: "messages" as const,
      label: "Mensagens",
      linkLabel: "Ver mensagens",
    },
    {
      description: `${activity.favoritesCount} ${activity.favoritesCount === 1 ? "favorito" : "favoritos"}`,
      href: routes.patient.favoriteTherapists,
      kind: "favorites" as const,
      label: "Favoritos",
      linkLabel: "Ver favoritos",
    },
    {
      description: `${activity.unreadNotificationsCount} nova${activity.unreadNotificationsCount === 1 ? " notificação" : "s notificações"}`,
      href: routes.patient.notificationSettings,
      kind: "notifications" as const,
      label: "Notificações",
      linkLabel: "Ver notificações",
    },
    {
      description: activity.lastActivityLabel
        ? `Última atividade: ${activity.lastActivityLabel}`
        : "Nenhuma atividade recente",
      href: routes.patient.encounterHistory,
      kind: "history" as const,
      label: "Histórico",
      linkLabel: "Ver histórico",
    },
  ];

  return (
    <section
      aria-labelledby="patient-activity-title"
      className="rounded-[var(--tes-radius-auth-card)] border border-[var(--tes-color-border)]/40 bg-white p-5 shadow-[var(--tes-shadow-auth-card)]"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id="patient-activity-title"
          className="font-display text-[25px] font-light italic text-[var(--tes-color-primary-dark)]"
        >
          Atividade
        </h2>
        <Link
          className="text-xs font-medium text-brand-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/20"
          href={routes.patient.encounterHistory as Route<string>}
        >
          Ver tudo <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <PatientActivityCard {...card} key={card.label} />
        ))}
      </div>
    </section>
  );
}
