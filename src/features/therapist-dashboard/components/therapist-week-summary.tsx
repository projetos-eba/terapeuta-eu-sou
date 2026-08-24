import Link from "next/link";
import type { Route } from "next";

import { TherapistPlan } from "@/domain/tes";
import {
  canAccessTherapistPlan,
  TherapistLockedCard,
} from "@/features/therapist-access";
import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";
import { AttendanceRateChart } from "./attendance-rate-chart";
import { TherapistWeekChart } from "./therapist-week-chart";

export function TherapistWeekSummary({
  plan,
  week,
}: {
  plan: TherapistPlan;
  week: TherapistDashboardPageData["week"];
}) {
  if (!canAccessTherapistPlan(plan, TherapistPlan.Premium)) {
    return (
      <TherapistLockedCard
        requiredPlan={TherapistPlan.Premium}
        title="Sua semana"
        variant="section"
      />
    );
  }

  return (
    <section className="rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand-deep">Sua semana</h2>
          <p className="mt-1 text-sm font-semibold text-brand-deep">
            {week.rangeLabel}
          </p>
        </div>
        <Link
          className="text-sm font-bold text-brand-deep outline-none hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
          href={routes.therapist.insights as Route<string>}
        >
          Ver mais →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-tesText-muted">
        <Legend color="#482861" label="Sessões agendadas" />
        <Legend color="#ae94c3" label="Sessões realizadas" />
        <Legend color="#ef5b7a" label="Cancelamentos" />
      </div>
      <div className="mt-4 grid items-center gap-6 xl:grid-cols-[minmax(0,1fr)_190px]">
        <TherapistWeekChart days={week.days} />
        <div className="border-t border-[var(--tes-color-border)] pt-6 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
          <AttendanceRateChart value={week.attendanceRate} />
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-0.5 w-3" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
