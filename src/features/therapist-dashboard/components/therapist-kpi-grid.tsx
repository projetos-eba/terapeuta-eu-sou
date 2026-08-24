import { CalendarCheck2, Eye, UsersRound, WalletCards } from "lucide-react";

import { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";
import { TherapistKpiCard } from "./therapist-kpi-card";

export function TherapistKpiGrid({
  kpis,
  plan,
}: {
  kpis: TherapistDashboardPageData["kpis"];
  plan: TherapistPlan;
}) {
  return (
    <section
      aria-label="Indicadores principais"
      className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4"
    >
      <TherapistKpiCard
        href={routes.therapist.agenda}
        icon={CalendarCheck2}
        kpi={kpis.monthlySessions}
        label="Sessões este mês"
        title="Sua agenda"
        plan={plan}
        requiredPlan={TherapistPlan.Free}
        value={formatNumber(kpis.monthlySessions.value)}
      />
      <TherapistKpiCard
        href={routes.therapist.patients}
        icon={UsersRound}
        kpi={kpis.activePatients}
        label="Pessoas em acompanhamento"
        title="Pessoas que caminham com você"
        plan={plan}
        requiredPlan={TherapistPlan.PremiumPlus}
        value={formatNumber(kpis.activePatients.value)}
      />
      <TherapistKpiCard
        href={routes.therapist.finance}
        icon={WalletCards}
        kpi={kpis.monthlyNetRevenueCents}
        label="Receita líquida do mês"
        title="Sua prática"
        plan={plan}
        requiredPlan={TherapistPlan.PremiumPlus}
        value={formatCurrency(kpis.monthlyNetRevenueCents.value)}
      />
      <TherapistKpiCard
        href={routes.therapist.insights}
        icon={Eye}
        kpi={kpis.profileViews}
        label="Visitas ao perfil"
        title="Como as pessoas estão encontrando você"
        plan={plan}
        requiredPlan={TherapistPlan.Premium}
        value={formatNumber(kpis.profileViews.value)}
      />
    </section>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value / 100);
}
