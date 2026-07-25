import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

import type { TherapistDashboardKpi } from "../therapist-dashboard.types";

export function TherapistKpiCard({
  href,
  icon: Icon,
  kpi,
  label,
  title,
  value,
}: {
  href: string;
  icon: LucideIcon;
  kpi: TherapistDashboardKpi;
  label: string;
  title: string;
  value: string;
}) {
  return (
    <article className="flex min-h-[278px] flex-col rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-md bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h3 className="text-base font-bold leading-5 text-brand-primary">
          {title}
        </h3>
      </div>
      <strong className="mt-8 block text-[34px] font-extrabold leading-none text-brand-deep">
        {value}
      </strong>
      <p className="mt-2 text-sm font-bold text-[#825aa2]">{label}</p>
      <p className="mt-6 text-xs font-bold text-[#ae94c3]">
        {formatTrend(kpi)}
      </p>
      <Link
        className="mt-auto pt-5 text-center text-xs font-bold text-[#825aa2] outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
        href={href as Route<string>}
      >
        Ver detalhes →
      </Link>
    </article>
  );
}

function formatTrend(kpi: TherapistDashboardKpi) {
  if (kpi.trend.percent === null) return "Novo neste período";
  if (kpi.trend.direction === "flat") return "Estável vs período anterior";
  return `${kpi.trend.direction === "up" ? "↑" : "↓"} ${kpi.trend.percent}% vs período anterior`;
}
