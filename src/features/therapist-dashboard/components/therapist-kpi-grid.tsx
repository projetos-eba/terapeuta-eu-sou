import { CalendarCheck2, Eye, UsersRound, WalletCards } from "lucide-react";

import { routes } from "@/lib/routes";

import type { TherapistDashboardPageData } from "../therapist-dashboard.types";
import { TherapistKpiCard } from "./therapist-kpi-card";

export function TherapistKpiGrid({
  kpis,
}: {
  kpis: TherapistDashboardPageData["kpis"];
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
        label="Encontros este mês"
        title="Sua agenda"
        value={formatNumber(kpis.monthlySessions.value)}
      />
      <TherapistKpiCard
        href={routes.therapist.patients}
        icon={UsersRound}
        kpi={kpis.activePatients}
        label="Pessoas em acompanhamento"
        title="Pessoas que caminham com você"
        value={formatNumber(kpis.activePatients.value)}
      />
      <TherapistKpiCard
        href={routes.therapist.finance}
        icon={WalletCards}
        kpi={kpis.monthlyNetRevenueCents}
        label="Receita líquida do mês"
        title="Sua prática"
        value={formatCurrency(kpis.monthlyNetRevenueCents.value)}
      />
      <TherapistKpiCard
        href={routes.therapist.insights}
        icon={Eye}
        kpi={kpis.profileViews}
        label="Visitas ao perfil"
        title="Como as pessoas estão encontrando você"
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
