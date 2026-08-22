import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  LockKeyhole,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import { AppPageSection } from "@/components/app-page";
import { routes } from "@/lib/routes";

import type {
  FinancialOpportunityAction,
  TherapistAdvancedFinancialDashboard,
  TherapistFinanceAdvancedAccess,
} from "../therapist-finance.types";
import {
  formatComparison,
  formatCurrency,
  formatDate,
  formatInteger,
  formatPercent,
} from "./financial-formatters";

export function FinancialAdvancedDashboard({
  advanced,
}: {
  advanced: TherapistFinanceAdvancedAccess;
}) {
  if (advanced.status === "locked") return <AdvancedLockedState />;

  const dashboard = advanced.dashboard;

  return (
    <section
      aria-label="Dashboard financeiro Premium Plus"
      className="grid gap-5"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdvancedMetricCard
          description="Valor líquido já realizado no mês de referência."
          label="Receita líquida realizada"
          value={formatCurrency(dashboard.forecast.realizedNetCents)}
        />
        <AdvancedMetricCard
          description="Sessões futuras já pagas e válidas. Não inclui pagamento pendente."
          label="Receita contratada futura"
          value={formatCurrency(dashboard.forecast.contractedFutureNetCents)}
        />
        <AdvancedMetricCard
          description="Realizado mais receita futura contratada no mês."
          label="Receita contratada no mês"
          value={formatCurrency(dashboard.forecast.contractedMonthNetCents)}
        />
        <AdvancedMetricCard
          description="Estimativa baseada na disponibilidade e nos valores atuais dos serviços. Não representa receita garantida."
          label="Potencial disponível da agenda"
          muted={dashboard.agendaPotential.status !== "available"}
          value={formatCurrency(
            dashboard.forecast.estimatedOpenAgendaPotentialCents,
          )}
        />
      </div>

      <AppPageSection className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ForecastBreakdown dashboard={dashboard} />
        <AgendaPotentialCard dashboard={dashboard} />
      </AppPageSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <OpportunityCard dashboard={dashboard} />
        <InsightCard dashboard={dashboard} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <RetentionCard dashboard={dashboard} />
        <AdvancedEvolutionCard dashboard={dashboard} />
      </div>

      <AdvancedRevenueByTherapy dashboard={dashboard} />
    </section>
  );
}

function AdvancedLockedState() {
  return (
    <AppPageSection className="grid gap-4 bg-brand-lavenderSoft/70 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <span className="grid size-12 place-items-center rounded-full bg-white text-brand-primary">
        <LockKeyhole aria-hidden="true" size={22} />
      </span>
      <div>
        <h2 className="text-lg font-extrabold text-brand-deep">
          Dashboard financeiro Premium Plus
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Projeções, potencial da agenda, oportunidades, retenção avançada,
          evolução financeira e insights acionáveis fazem parte do Premium Plus.
          Recebimentos, repasses e conta de recebimento continuam disponíveis.
        </p>
      </div>
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.plan}
      >
        Ver Premium Plus
      </Link>
    </AppPageSection>
  );
}

function AdvancedMetricCard({
  description,
  label,
  muted = false,
  value,
}: {
  description: string;
  label: string;
  muted?: boolean;
  value: string;
}) {
  return (
    <article className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <TrendingUp aria-hidden="true" size={22} />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-brand-deep">{label}</h2>
      <p
        className={`mt-2 text-[24px] font-extrabold leading-tight ${
          muted ? "text-tesText-secondary" : "text-brand-deep"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {description}
      </p>
    </article>
  );
}

function ForecastBreakdown({
  dashboard,
}: {
  dashboard: TherapistAdvancedFinancialDashboard;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-brand-deep">
          Previsão do mês
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Realizado, contratado e estimado aparecem separados. O potencial é uma
          estimativa explicável, não receita garantida.
        </p>
      </div>
      <dl className="grid gap-3">
        <BreakdownRow
          label="Realizado líquido"
          tone="strong"
          value={dashboard.forecast.realizedNetCents}
        />
        <BreakdownRow
          label="Receita contratada futura"
          value={dashboard.forecast.contractedFutureNetCents}
        />
        <BreakdownRow
          label="Potencial estimado da agenda"
          value={dashboard.forecast.estimatedOpenAgendaPotentialCents}
        />
        <div className="h-px bg-brand-lavender" />
        <BreakdownRow
          label="Total estimado, com separação metodológica"
          tone="strong"
          value={dashboard.forecast.totalEstimatedPotentialCents}
        />
      </dl>
      <p className="rounded-lg bg-surface-soft p-3 text-sm font-semibold leading-6 text-tesText-secondary">
        Esta leitura separa o que já aconteceu, o que está contratado e o que é
        apenas uma estimativa. Confiança:{" "}
        <span className="font-extrabold text-brand-deep">
          {confidenceLabel(dashboard.forecast.confidence)}
        </span>
        .
      </p>
    </div>
  );
}

function BreakdownRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "strong";
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-brand-lavender bg-white p-4">
      <dt
        className={
          tone === "strong"
            ? "text-base font-extrabold text-brand-deep"
            : "text-sm font-bold text-tesText-secondary"
        }
      >
        {label}
      </dt>
      <dd className="text-base font-extrabold text-brand-deep">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

function AgendaPotentialCard({
  dashboard,
}: {
  dashboard: TherapistAdvancedFinancialDashboard;
}) {
  const potential = dashboard.agendaPotential;
  const maxMinutes = Math.max(1, potential.capacityMinutes);
  const committedPercent = Math.min(
    100,
    Math.round((potential.committedMinutes / maxMinutes) * 100),
  );
  const availablePercent = Math.min(
    100,
    Math.round((potential.availableMinutes / maxMinutes) * 100),
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <CalendarDays aria-hidden="true" size={21} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Ocupação e potencial da agenda
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Janela: {formatDate(potential.windowStart)} a{" "}
            {formatDate(potential.windowEnd)}.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="Ocupação"
          value={formatPercent(potential.occupancyRate)}
        />
        <MiniStat
          label="Slots estimados"
          value={formatInteger(potential.estimatedBookableSlots)}
        />
        <MiniStat
          label="Potencial esperado"
          value={formatCurrency(potential.expectedPotentialCents)}
        />
      </div>

      <div className="grid gap-3 rounded-card border border-brand-lavender bg-surface-soft p-4">
        <ProgressLine
          label="Já comprometido"
          percent={committedPercent}
          value={`${formatInteger(potential.committedMinutes)} min`}
        />
        <ProgressLine
          label="Potencial disponível"
          percent={availablePercent}
          value={`${formatInteger(potential.availableMinutes)} min`}
        />
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="Conservador"
          value={formatCurrency(potential.conservativePotentialCents)}
        />
        <MiniStat
          label="Esperado"
          value={formatCurrency(potential.expectedPotentialCents)}
        />
        <MiniStat
          label="Máximo"
          value={formatCurrency(potential.maximumPotentialCents)}
        />
      </dl>

      <Link
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.agenda}
      >
        Ver horários disponíveis
      </Link>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-brand-lavender bg-white p-4">
      <dt className="text-sm font-bold text-tesText-secondary">{label}</dt>
      <dd className="mt-1 text-lg font-extrabold text-brand-deep">{value}</dd>
    </div>
  );
}

function ProgressLine({
  label,
  percent,
  value,
}: {
  label: string;
  percent: number;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm font-bold text-brand-deep">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-brand-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function OpportunityCard({
  dashboard,
}: {
  dashboard: TherapistAdvancedFinancialDashboard;
}) {
  const opportunity = dashboard.opportunities.primary;

  return (
    <AppPageSection className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Target aria-hidden="true" size={21} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Oportunidade do mês
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Gerada por regras determinísticas a partir dos seus próprios dados.
          </p>
        </div>
      </div>
      <div className="rounded-card border border-brand-lavender bg-white p-5">
        <h3 className="text-lg font-extrabold text-brand-deep">
          {opportunity.title}
        </h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {opportunity.description}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <MiniStat
            label="Impacto estimado"
            value={
              opportunity.estimatedImpactCents === null
                ? "Sem estimativa confiável"
                : formatCurrency(opportunity.estimatedImpactCents)
            }
          />
          <MiniStat
            label="Confiança"
            value={confidenceLabel(opportunity.confidence)}
          />
        </dl>
        <EvidenceList evidence={opportunity.evidence} />
        <OpportunityActionLink action={opportunity.action} />
      </div>
    </AppPageSection>
  );
}

function InsightCard({
  dashboard,
}: {
  dashboard: TherapistAdvancedFinancialDashboard;
}) {
  const insight = dashboard.insights.items[0];

  return (
    <AppPageSection className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Sparkles aria-hidden="true" size={21} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Insight TES
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Sem IA generativa: a explicação vem de regras e evidências exibidas.
          </p>
        </div>
      </div>
      {insight ? (
        <div className="rounded-card border border-brand-lavender bg-white p-5">
          <h3 className="text-lg font-extrabold text-brand-deep">
            {insight.title}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {insight.explanation}
          </p>
          <EvidenceList evidence={insight.evidence} />
          <OpportunityActionLink action={insight.action} />
        </div>
      ) : (
        <EmptyAdvancedState message="Ainda não há insight financeiro com evidência suficiente." />
      )}
    </AppPageSection>
  );
}

function EvidenceList({
  evidence,
}: {
  evidence: Array<{
    metric: string;
    periodEnd: string;
    periodStart: string;
    value: number | string;
  }>;
}) {
  if (!evidence.length) return null;

  return (
    <ul className="mt-4 grid gap-2">
      {evidence.map((item) => (
        <li
          className="rounded-lg bg-surface-soft p-3 text-sm font-semibold leading-6 text-tesText-secondary"
          key={`${item.metric}-${item.periodStart}-${item.periodEnd}`}
        >
          <span className="font-extrabold text-brand-deep">{item.metric}</span>:{" "}
          {String(item.value)} entre {formatDate(item.periodStart)} e{" "}
          {formatDate(item.periodEnd)}.
        </li>
      ))}
    </ul>
  );
}

function OpportunityActionLink({
  action,
}: {
  action: FinancialOpportunityAction;
}) {
  const href =
    action === "open_agenda" || action === "review_availability"
      ? routes.therapist.agenda
      : action === "review_services"
        ? routes.therapist.services
        : action === "review_cancellations"
          ? routes.therapist.sessions
          : action === "view_patients_without_return"
            ? routes.therapist.insights
            : null;

  if (!href) return null;

  return (
    <Link
      className="mt-4 inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-brand-primary px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      href={href}
    >
      Abrir ação sugerida
    </Link>
  );
}

function RetentionCard({
  dashboard,
}: {
  dashboard: TherapistAdvancedFinancialDashboard;
}) {
  return (
    <AppPageSection className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <UsersRound aria-hidden="true" size={21} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Retenção de pacientes
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Coortes por mês, com janela incompleta censurada.
          </p>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="Retorno em 90 dias"
          value={formatPercent(dashboard.retention.returnRate)}
        />
        <MiniStat
          label="Elegíveis"
          value={formatInteger(dashboard.retention.eligiblePatients)}
        />
        <MiniStat
          label="Mediana até retorno"
          value={
            dashboard.retention.medianDaysToReturn === null
              ? "Sem base"
              : `${dashboard.retention.medianDaysToReturn} dias`
          }
        />
      </dl>
      {dashboard.retention.cohorts.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-xs font-extrabold uppercase text-tesText-muted">
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Coorte
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Novos
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Retornaram
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Sem retorno
                </th>
                <th className="border-b border-brand-lavender py-3">
                  Censurados
                </th>
              </tr>
            </thead>
            <tbody>
              {dashboard.retention.cohorts.map((cohort) => (
                <tr
                  className="text-sm font-bold text-brand-deep"
                  key={cohort.cohortMonth}
                >
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {formatDate(cohort.cohortMonth)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {formatInteger(cohort.newPatients)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {formatInteger(cohort.returningPatients)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {formatInteger(cohort.withoutReturnPatients)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3">
                    {formatInteger(cohort.censoredPatients)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyAdvancedState message="Ainda não há coortes suficientes para análise avançada." />
      )}
    </AppPageSection>
  );
}

function AdvancedEvolutionCard({
  dashboard,
}: {
  dashboard: TherapistAdvancedFinancialDashboard;
}) {
  const maxValue = Math.max(
    1,
    ...dashboard.financialEvolution.flatMap((point) => [
      point.realizedNetCents,
      point.contractedNetCents,
      point.projectedNetCents ?? 0,
      point.previousPeriodNetCents ?? 0,
    ]),
  );

  return (
    <AppPageSection className="grid gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-brand-deep">
          Evolução com projeção
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Séries separadas para realizado, contratado, estimado e período
          anterior.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 text-xs font-extrabold text-tesText-secondary">
        <Legend colorClass="bg-brand-primary" label="Realizado" />
        <Legend colorClass="bg-status-info" label="Contratado" />
        <Legend colorClass="bg-brand-deep" label="Estimado" />
        <Legend colorClass="bg-brand-lavender" label="Período anterior" />
      </div>
      {dashboard.financialEvolution.length ? (
        <div className="flex min-h-[190px] items-end gap-3 overflow-x-auto rounded-card border border-brand-lavender bg-surface-soft px-4 pb-3 pt-5">
          {dashboard.financialEvolution.map((point) => (
            <div
              className="flex min-w-[76px] flex-1 flex-col items-center gap-2"
              key={point.periodStart}
            >
              <div className="flex h-28 items-end gap-1">
                <Bar
                  label={`Realizado ${formatCurrency(point.realizedNetCents)}`}
                  max={maxValue}
                  value={point.realizedNetCents}
                />
                <Bar
                  className="bg-status-info"
                  label={`Contratado ${formatCurrency(point.contractedNetCents)}`}
                  max={maxValue}
                  value={point.contractedNetCents}
                />
                <Bar
                  className="bg-brand-deep"
                  label={`Estimado ${formatCurrency(point.projectedNetCents ?? 0)}`}
                  max={maxValue}
                  value={point.projectedNetCents ?? 0}
                />
                <Bar
                  className="bg-brand-lavender"
                  label={`Período anterior ${formatCurrency(point.previousPeriodNetCents ?? 0)}`}
                  max={maxValue}
                  value={point.previousPeriodNetCents ?? 0}
                />
              </div>
              <span className="text-xs font-bold text-tesText-secondary">
                {formatDate(point.periodStart).slice(0, 5)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyAdvancedState message="Sem série financeira avançada para o período." />
      )}
    </AppPageSection>
  );
}

function Legend({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-3 rounded-sm ${colorClass}`} /> {label}
    </span>
  );
}

function Bar({
  className = "bg-brand-primary",
  label,
  max,
  value,
}: {
  className?: string;
  label: string;
  max: number;
  value: number;
}) {
  return (
    <span
      aria-label={label}
      className={`w-3 rounded-t ${className}`}
      style={{ height: `${Math.max(4, (value / max) * 112)}px` }}
    />
  );
}

function AdvancedRevenueByTherapy({
  dashboard,
}: {
  dashboard: TherapistAdvancedFinancialDashboard;
}) {
  return (
    <AppPageSection className="grid gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-brand-deep">
          Terapias que mais faturam
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Ordenado por receita líquida, com participação e tendência frente ao
          período anterior.
        </p>
      </div>
      {dashboard.revenueByTherapy.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-xs font-extrabold uppercase text-tesText-muted">
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Terapia
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Líquido
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Participação
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Ticket médio
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Sessões
                </th>
                <th className="border-b border-brand-lavender py-3">
                  Tendência
                </th>
              </tr>
            </thead>
            <tbody>
              {dashboard.revenueByTherapy.map((item, index) => (
                <tr
                  className="text-sm font-bold text-brand-deep"
                  key={`${item.therapyId ?? item.therapyNameSnapshot}-${index}`}
                >
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    <span className="mr-3 inline-grid size-7 place-items-center rounded-full bg-brand-lavenderSoft text-xs font-extrabold text-brand-primary">
                      {index + 1}
                    </span>
                    {item.therapyNameSnapshot}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {formatCurrency(item.therapistNetAmountCents)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {formatPercent(item.revenueSharePercent)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {item.averageTicketCents === null
                      ? "Sem base"
                      : formatCurrency(item.averageTicketCents)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {formatInteger(item.paidSessionCount)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3">
                    {formatComparison(item.trend, {
                      formatter: (value) => formatCurrency(value),
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyAdvancedState message="Nenhuma terapia teve pagamento confirmado neste período." />
      )}
    </AppPageSection>
  );
}

function EmptyAdvancedState({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-5">
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
    </div>
  );
}

function confidenceLabel(value: "high" | "low" | "medium") {
  if (value === "high") return "alta";
  if (value === "medium") return "média";
  return "baixa";
}
