import { CalendarDays, Clock3, Star, UserRoundPlus } from "lucide-react";

import { TherapistPlan } from "@/domain/tes";
import {
  canAccessTherapistPlan,
  TherapistLockedCard,
} from "@/features/therapist-access";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";

export function TherapistHeroStats({
  plan,
  today,
}: {
  plan: TherapistPlan;
  today: TherapistDashboardPageData["today"];
}) {
  if (!canAccessTherapistPlan(plan, TherapistPlan.Premium)) {
    return (
      <TherapistLockedCard
        className="min-h-24 rounded-panel border-[var(--tes-color-border)]/70 p-4 sm:p-5"
        requiredPlan={TherapistPlan.Premium}
        title="Estatísticas rápidas"
        variant="compact"
      />
    );
  }

  const stats = [
    {
      icon: CalendarDays,
      label: "Sessões hoje",
      value: today.sessionsToday.toLocaleString("pt-BR"),
      iconClassName: "bg-brand-lavenderSoft text-brand-primary",
    },
    {
      icon: UserRoundPlus,
      label: "Novas conexões",
      value: today.newConnections.toLocaleString("pt-BR"),
      iconClassName: "bg-status-successBg text-status-success",
    },
    {
      icon: Star,
      label: "Avaliações sem resposta",
      value: today.pendingReviewReplies.toLocaleString("pt-BR"),
      iconClassName: "bg-status-warningBg text-status-warning",
    },
    {
      icon: Clock3,
      label: "Tempo reservado hoje",
      value: formatMinutes(today.reservedMinutesToday),
      iconClassName: "bg-brand-lavenderSoft text-brand-primary",
    },
  ];

  return (
    <div className="grid overflow-hidden rounded-panel border border-[var(--tes-color-border)]/70 bg-white sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ icon: Icon, iconClassName, label, value }) => (
        <div
          className="flex min-h-24 items-center gap-3 border-b border-[var(--tes-color-border)]/70 px-4 py-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
          key={label}
        >
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-md ${iconClassName}`}
          >
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
