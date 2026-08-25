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
        description="Veja como suas sessões se distribuem ao longo da semana e acompanhe sua taxa de comparecimento."
        dialogBody={
          <p className="text-sm font-semibold leading-6 text-tesText-primary">
            No Premium, você acompanha sessões agendadas, realizadas,
            cancelamentos e a taxa de comparecimento em uma visão simples da
            sua semana.
          </p>
        }
        dialogDescription="O detalhe da sua semana está disponível a partir do plano Premium."
        dialogTitle="Acompanhe sua semana com mais clareza"
        requiredPlan={TherapistPlan.Premium}
        title="Sua semana"
        triggerLabel="Ver mais"
        variant="section"
      />
    );
  }

  if (week.state === "unavailable") {
    return (
      <section className="rounded-panel border border-[var(--tes-color-border)]/70 bg-white p-5 shadow-card sm:p-6">
        <h2 className="text-xl font-bold text-brand-deep">Sua semana</h2>
        <p className="mt-4 rounded-xl bg-status-warningBg p-4 text-sm font-semibold leading-6 text-tesText-secondary">
          Não foi possível carregar os dados da sua semana agora. Tente
          novamente em alguns instantes.
        </p>
      </section>
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
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-tesText-muted">
        <Legend color="var(--tes-color-brand-deep)" label="Sessões agendadas" />
        <Legend color="var(--tes-color-brand-lavender)" label="Sessões realizadas" />
        <Legend color="var(--tes-color-status-danger)" label="Cancelamentos" />
      </div>
      <div className="mt-4 grid items-center gap-6 xl:grid-cols-[minmax(0,1fr)_190px]">
        <div>
          <TherapistWeekChart days={week.days} />
          {week.state === "empty" ? (
            <p className="mt-2 text-center text-sm font-semibold text-tesText-muted">
              Nenhuma sessão foi registrada nesta semana.
            </p>
          ) : null}
        </div>
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
