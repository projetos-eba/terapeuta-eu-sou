import { CalendarDays, Clock3, Star, UserRoundPlus } from "lucide-react";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function TherapistHeroStats({
  today,
}: {
  today: TherapistDashboardPageData["today"];
}) {
  const stats = [
    {
      icon: CalendarDays,
      label: "Sessões hoje",
      value: today.sessionsToday.toLocaleString("pt-BR"),
    },
    {
      icon: UserRoundPlus,
      label: "Novas conexões",
      value: today.newConnections.toLocaleString("pt-BR"),
    },
    {
      icon: Star,
      label: "Avaliações sem resposta",
      value: today.pendingReviewReplies.toLocaleString("pt-BR"),
    },
    {
      icon: Clock3,
      label: "Tempo reservado hoje",
      value: formatMinutes(today.reservedMinutesToday),
    },
  ];

  return (
    <div className="grid overflow-hidden rounded-panel border border-[var(--tes-color-border)]/70 bg-white sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ icon: Icon, label, value }) => (
        <div
          className="flex min-h-24 items-center gap-3 border-b border-[var(--tes-color-border)]/70 px-4 py-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
          key={label}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-lavenderSoft text-brand-primary">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0">
            <strong className="block text-2xl font-extrabold text-brand-deep">
              {value}
            </strong>
            <span className="block text-xs font-bold leading-4 text-brand-deep">
              {label}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes}min`;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}
