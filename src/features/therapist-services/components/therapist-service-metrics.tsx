import { CalendarCheck, Heart } from "lucide-react";

import type { TherapistServiceSummary } from "../therapist-services.types";

export function TherapistServiceMetrics({
  service,
}: {
  service: TherapistServiceSummary;
}) {
  return (
    <div className="pointer-events-none grid grid-cols-2 gap-3 md:min-w-[210px] md:grid-cols-1 xl:min-w-[220px]">
      <MetricItem
        icon={<Heart aria-hidden="true" size={18} />}
        label="Interesses"
        value={service.metrics.favoriteCount}
      />
      <MetricItem
        delta={service.metrics.bookingCountDeltaPercent}
        icon={<CalendarCheck aria-hidden="true" size={18} />}
        label="Agendamentos"
        value={service.metrics.bookingCount}
      />
    </div>
  );
}

function MetricItem({
  delta,
  icon,
  label,
  value,
}: {
  delta?: number | null;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-brand-lavenderSoft/70 p-3">
      <div className="flex items-center gap-2 text-xs font-extrabold text-brand-primary">
        {icon}
        {label}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <strong className="text-xl text-brand-deep">{value}</strong>
        {delta === null || delta === undefined ? (
          <span className="text-xs font-bold text-tesText-muted">
            Ainda sem dados
          </span>
        ) : (
          <span className="rounded-full bg-status-successBg px-2 py-1 text-[11px] font-extrabold text-status-success">
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
    </div>
  );
}
