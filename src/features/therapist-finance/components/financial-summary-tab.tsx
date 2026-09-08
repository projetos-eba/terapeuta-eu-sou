import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Info,
  Lightbulb,
  Sparkles,
  Ticket,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { TherapistPlan } from "@/domain/tes";
import { TherapistLockedCard } from "@/features/therapist-access";
import {
  MetricSparkline,
  type MetricChartTone,
} from "@/features/therapist-metrics/components/therapist-metrics-charts";
import type {
  FinancialMetricComparison,
  TherapistAdvancedFinancialDashboard,
  TherapistFinanceAdvancedAccess,
  TherapistFinanceAnalyticsAccess,
  TherapistFinancialMetrics,
  TherapistFinancialOverview,
} from "../therapist-finance.types";
import {
  FinancialEvolutionChart,
  type FinancialEvolutionHighlight,
} from "./financial-evolution-chart";
import {
  formatComparison,
  formatCurrency,
  formatCurrencyOrDash,
  formatDate,
  formatDateTime,
  formatInteger,
  formatIntegerOrDash,
  formatPercent,
} from "./financial-formatters";
import { FinancialInfoTooltip } from "./financial-info-tooltip";

export function FinancialSummaryTab({
  advanced,
  analytics,
  overview,
}: {
  advanced: TherapistFinanceAdvancedAccess;
  analytics: TherapistFinanceAnalyticsAccess;
  overview: TherapistFinancialOverview;
}) {
  const metrics = analytics.status === "available" ? analytics.metrics : null;
  const dashboard = advanced.status === "available" ? advanced.dashboard : null;
  const receivable =
    overview.waitingConfirmationCents +
    overview.waitingSafetyPeriodCents +
    overview.eligibleForPayoutCents +
    overview.payoutProcessingCents;
  const forecast = dashboard?.forecast ?? null;
  const forecastAvailable = forecast?.status === "available";
  const hasFinancialData = hasOverviewFinancialData(overview);
  const hasMetricsData =
    metrics !== null &&
    (metrics.revenue.paidSessionCount > 0 ||
      metrics.sessions.completedCount > 0 ||
      metrics.sessions.cancelledCount > 0 ||
      metrics.sessions.rescheduledCount > 0);
  const financialEvolution =
    metrics?.financialEvolution.map((point) => ({
      label: point.periodStart,
      value: point.therapistNetAmountCents,
    })) ?? [];
  const contractedEvolution =
    dashboard?.financialEvolution.map((point) => ({
      label: point.periodStart,
      value: point.contractedNetCents,
    })) ?? [];

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <section
        aria-label="Panorama financeiro"
        className="grid min-w-0 gap-4 [&>*]:min-w-0"
      >
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-brand-deep sm:text-2xl">
          Resumo rápido
        </h2>
        {analytics.status === "locked" ? (
          <TherapistLockedCard
            className="sm:col-span-2 xl:col-span-5"
            description="Indicadores e acompanhamento financeiro ficam disponíveis no Premium, quando fizer sentido para o momento da sua prática."
            requiredPlan={TherapistPlan.Premium}
            title="Panorama financeiro"
            variant="section"
          />
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-4 [&>*]:min-w-0">
            <FinancialKpiCard
              accent="green"
              comparison={metrics?.revenue.comparison.therapistNet}
              helpText="É o valor que pertence a você após os custos da plataforma e os reembolsos confirmados, quando houver."
              icon={CircleDollarSign}
              label="Receita líquida"
              showFlowArrow
              sparkline={financialEvolution}
              valueNote="No período selecionado"
              value={formatCurrencyOrDash(
                overview.therapistNetCents,
                hasFinancialData,
              )}
            />
            <FinancialKpiCard
              accent="blue"
              helpText="Reúne valores que continuam em confirmação, liquidação ou processamento antes do próximo repasse."
              icon={WalletCards}
              label="A receber"
              sparkline={[]}
              status={
                !hasFinancialData
                  ? "Sem dados"
                  : receivable === 0
                    ? "Sem pendências"
                    : "Acompanhando o próximo repasse"
              }
              valueNote="Valores em andamento"
              value={formatCurrencyOrDash(receivable, hasFinancialData)}
              showFlowArrow
            />
            {advanced.status === "locked" ? (
              <TherapistLockedCard
                description="A previsão separa o que já aconteceu do que ainda é possibilidade, para apoiar suas decisões com mais clareza."
                requiredPlan={TherapistPlan.PremiumPlus}
                title="Previsto no mês"
                variant="compact"
              />
            ) : (
              <FinancialKpiCard
                accent="violet"
                helpText="Mostra a receita contratada no mês. O potencial da agenda aparece separado porque é uma estimativa, não uma receita garantida."
                icon={TrendingUp}
                label="Previsto no mês"
                sparkline={contractedEvolution}
                status={
                  forecastAvailable && forecast
                    ? forecastProgressLabel(forecast)
                    : "Aguardando base suficiente"
                }
                tone={forecastAvailable ? "success" : "muted"}
                valueNote="Receita contratada no mês"
                value={
                  forecastAvailable && forecast
                    ? formatCurrency(forecast.contractedMonthNetCents)
                    : "-"
                }
                showFlowArrow
              />
            )}
            <FinancialKpiCard
              accent="orange"
              comparison={metrics?.revenue.comparison.averageTicket}
              helpText={`A média principal é líquida. O valor bruto no período é ${
                metrics && metrics.revenue.grossAverageTicketCents !== null
                  ? formatCurrency(metrics.revenue.grossAverageTicketCents)
                  : "sem dados"
              }.`}
              icon={Ticket}
              label="Ticket médio"
              sparkline={[]}
              valueNote={
                metrics
                  ? `Média líquida de ${formatInteger(metrics.revenue.paidSessionCount)} sessões pagas`
                  : "Disponível no Premium"
              }
              value={
                metrics && metrics.revenue.netAverageTicketCents !== null
                  ? formatCurrency(metrics.revenue.netAverageTicketCents)
                  : "-"
              }
              showFlowArrow
            />
            <FinancialKpiCard
              accent="cyan"
              helpText="Conta as sessões concluídas ou confirmadas no período selecionado."
              icon={CalendarDays}
              label="Sessões realizadas"
              sparkline={[]}
              status={
                metrics
                  ? hasMetricsData
                    ? `${formatInteger(metrics.sessions.completedCount)} no período`
                    : "Sem dados no período"
                  : "Disponível no Premium"
              }
              tone={metrics ? "success" : "muted"}
              valueNote="No período selecionado"
              value={
                metrics
                  ? formatIntegerOrDash(
                      metrics.sessions.completedCount,
                      hasMetricsData,
                    )
                  : "-"
              }
            />
          </div>
        )}
      </section>

      <section
        aria-label="Leituras financeiras"
        className="grid min-w-0 gap-5 xl:grid-cols-3 [&>*]:min-w-0"
      >
        {analytics.status === "locked" ? (
          <TherapistLockedCard
            description="Acompanhe a composição dos seus recebimentos com uma visão mais completa."
            requiredPlan={TherapistPlan.Premium}
            title="Composição financeira"
            variant="section"
          />
        ) : (
          <MoneyCompositionPanel overview={overview} />
        )}
        {advanced.status === "locked" ? (
          <TherapistLockedCard
            description="Uma leitura avançada pode ajudar no planejamento da sua agenda, sem misturar estimativa com receita garantida."
            requiredPlan={TherapistPlan.PremiumPlus}
            title="Saúde financeira"
            variant="section"
          />
        ) : (
          <AgendaPotentialPanel advanced={advanced} />
        )}
        <OpportunityOfMonth advanced={advanced} />
      </section>

      <section
        aria-label="Visão estratégica"
        className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] [&>*]:min-w-0"
      >
        <div className="grid min-w-0 content-start gap-5">
          <TherapyRankingCard metrics={metrics} />
          <FinancialMethodology
            advanced={advanced}
            generatedAt={overview.generatedAt}
            timezone={overview.timezone}
          />
        </div>
        <FinancialEvolutionCard
          advanced={dashboard}
          metrics={metrics}
          overview={overview}
        />
      </section>
    </div>
  );
}

function hasOverviewFinancialData(overview: TherapistFinancialOverview) {
  return (
    overview.grossPaidCents > 0 ||
    overview.therapistNetCents > 0 ||
    overview.refundedToCustomersCents > 0 ||
    overview.transferredCents > 0 ||
    overview.waitingConfirmationCents > 0 ||
    overview.waitingSafetyPeriodCents > 0 ||
    overview.eligibleForPayoutCents > 0 ||
    overview.payoutProcessingCents > 0
  );
}

function FinancialKpiCard({
  accent,
  comparison,
  helpText,
  icon: Icon,
  label,
  showFlowArrow = false,
  sparkline,
  status,
  tone = "default",
  valueNote,
  value,
}: {
  accent: "blue" | "cyan" | "green" | "orange" | "purple" | "violet";
  comparison?: FinancialMetricComparison;
  helpText: string;
  icon: LucideIcon;
  label: string;
  showFlowArrow?: boolean;
  sparkline: Array<{ label: string; value: number }>;
  status?: string;
  tone?: "default" | "muted" | "success";
  valueNote: string;
  value: string;
}) {
  const accentClasses = {
    blue: "bg-status-infoBg text-status-info",
    cyan: "bg-brand-cyanSoft text-brand-cyan",
    green: "bg-status-successBg text-status-success",
    orange: "bg-status-warningBg text-status-warning",
    purple: "bg-brand-lavenderSoft text-brand-primary",
    violet: "bg-surface-mist text-brand-primaryPressed",
  } as const;
  const sparklineTone: Record<typeof accent, MetricChartTone> = {
    blue: "cyan",
    cyan: "cyan",
    green: "mint",
    orange: "warning",
    purple: "primary",
    violet: "primary",
  };
  const comparisonText = comparison
    ? formatComparison(comparison, { formatter: formatCurrency })
    : null;
  const statusText = comparisonText ?? status ?? "Sem dados no período";
  const statusClass =
    tone === "muted"
      ? "text-tesText-muted"
      : comparison && comparison.comparisonStatus !== "available"
        ? "text-tesText-muted"
        : tone === "success" ||
            comparison?.absoluteDelta === null ||
            (comparison?.absoluteDelta ?? 0) >= 0
          ? "text-status-success"
          : "text-status-danger";
  const comparisonAvailable = comparison?.comparisonStatus === "available";
  const comparisonIsPositive = (comparison?.absoluteDelta ?? 0) >= 0;
  const TrendIcon = comparisonIsPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="relative grid min-h-[322px] grid-rows-[auto_auto_1fr_auto] overflow-visible rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-full ${accentClasses[accent]}`}
          >
            <Icon aria-hidden="true" size={21} />
          </span>
          <h2 className="text-sm font-extrabold text-brand-deep">{label}</h2>
        </div>
        <FinancialInfoTooltip align="end" label={label} text={helpText} />
      </div>
      <div className="mt-7">
        <p
          className={`break-words tabular-nums text-[27px] font-extrabold leading-none tracking-[-0.035em] sm:text-[31px] ${tone === "muted" ? "text-tesText-muted" : "text-brand-deep"}`}
        >
          {value}
        </p>
        <p className="mt-3 text-sm font-semibold leading-5 text-tesText-secondary">
          {valueNote}
        </p>
      </div>
      <div className="mt-5 self-start">
        <p className={`flex items-center gap-1.5 text-sm font-extrabold ${statusClass}`}>
          {comparisonAvailable ? (
            <TrendIcon aria-hidden="true" className="shrink-0" size={18} />
          ) : null}
          {statusText}
        </p>
        {comparison ? (
          <p className="mt-1 text-[11px] font-bold leading-4 text-tesText-secondary">
            em relação ao período anterior
          </p>
        ) : null}
      </div>
      <div className="mt-5 border-t border-brand-lavender/70 pt-4">
        <MetricSparkline
          className="h-12"
          data={sparkline}
          empty={sparkline.length < 2}
          label={`Tendência de ${label}`}
          tone={sparklineTone[accent]}
        />
      </div>
      {showFlowArrow ? (
        <ArrowRight
          aria-hidden="true"
          className="pointer-events-none absolute -right-[25px] top-[45%] z-10 hidden size-8 rounded-full bg-white p-1 text-brand-primary xl:block"
          strokeWidth={1.8}
        />
      ) : null}
    </article>
  );
}

function MoneyCompositionPanel({
  overview,
}: {
  overview: TherapistFinancialOverview;
}) {
  const hasFinancialData = hasOverviewFinancialData(overview);
  const rows = [
    {
      color: "bg-brand-primary",
      label: "Valor bruto",
      note: "Antes dos custos da plataforma e reembolsos",
      value: formatCurrencyOrDash(overview.grossPaidCents, hasFinancialData),
    },
    {
      color: "bg-status-danger",
      label: "Custos da plataforma",
      note: "Incluídos no cálculo do repasse",
      value: hasFinancialData
        ? `− ${formatCurrency(Math.abs(overview.tesCommissionCents))}`
        : "-",
    },
    ...(overview.refundedToCustomersCents > 0
      ? [
          {
            color: "bg-status-warning",
            label: "Reembolsos ao cliente",
            note: "Devoluções confirmadas no período",
            value: `− ${formatCurrency(Math.abs(overview.refundedToCustomersCents))}`,
          },
        ]
      : []),
    {
      color: "bg-status-success",
      label: "Valor líquido",
      note: "Já faturado por você",
      value: formatCurrencyOrDash(overview.therapistNetCents, hasFinancialData),
    },
  ];

  return (
    <section className="grid min-h-[430px] content-start gap-6 rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-brand-deep">
          Seu dinheiro
        </h2>
        <FinancialInfoTooltip
          align="end"
          label="Seu dinheiro"
          text="Veja como o valor bruto, os custos da plataforma e os reembolsos confirmados compõem sua receita líquida."
        />
      </div>

      <dl className="grid divide-y divide-brand-lavender/80 border-y border-brand-lavender/80">
        {rows.map((row, index) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-4"
            key={row.label}
          >
            <dt className="flex min-w-0 gap-3">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-3 shrink-0 rounded-full ${row.color}`}
              />
              <span>
                <span className="flex items-center gap-1">
                  <strong className="block text-sm font-extrabold text-brand-deep">
                    {row.label}
                  </strong>
                  {row.label === "Custos da plataforma" ? (
                    <FinancialInfoTooltip
                      label="Custos da plataforma"
                      text="Custos da plataforma incluem os valores previstos para uso da plataforma e processamento dos atendimentos. Consulte o Termo de Uso."
                    />
                  ) : null}
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-tesText-secondary">
                  {row.note}
                </span>
              </span>
            </dt>
            <dd
              className={`self-center whitespace-nowrap text-sm font-extrabold tabular-nums ${index === rows.length - 1 ? "text-status-success" : "text-brand-deep"}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="flex items-start gap-3 rounded-xl bg-brand-lavenderSoft/70 px-4 py-4 text-sm font-semibold leading-6 text-tesText-secondary">
        <Info
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={20}
        />
        Os custos da plataforma já estão considerados no valor líquido que
        pertence a você.
      </p>
    </section>
  );
}

function AgendaPotentialPanel({
  advanced,
}: {
  advanced: TherapistFinanceAdvancedAccess;
}) {
  const agenda =
    advanced.status === "available" ? advanced.dashboard.agendaPotential : null;
  const available = agenda?.status === "available";
  const occupancy = available ? agenda?.occupancyRate : null;
  const capacity = available ? agenda?.capacityMinutes ?? 0 : 0;
  const contracted = advanced.status === "available" && advanced.dashboard.forecast.status === "available"
    ? advanced.dashboard.forecast.contractedMonthNetCents
    : null;

  return (
    <section className="grid min-h-[430px] content-start gap-5 rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-xl font-extrabold tracking-[-0.02em] text-brand-deep">
            Saúde financeira
          </h2>
          <FinancialInfoTooltip
            label="Saúde financeira"
            text="A ocupação usa a agenda disponível no período. Os valores de potencial são estimativas e não representam receita garantida."
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_148px] sm:items-center">
        <div>
          <p className="text-sm font-bold text-tesText-secondary">
            Capacidade utilizada
          </p>
          <p className="mt-2 tabular-nums text-[31px] font-extrabold leading-none tracking-[-0.035em] text-brand-deep">
            {available && occupancy !== null ? formatPercent(occupancy) : "-"}
          </p>
          <p className="mt-3 text-sm font-semibold leading-5 text-status-success">
            {available
              ? `${formatMinutes(agenda?.committedMinutes ?? 0)} já comprometidos no período`
              : "Aguardando base suficiente"}
          </p>
        </div>
        <OccupancyDonut occupancy={occupancy} reference={!available} />
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-brand-lavenderSoft">
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-status-success"
          style={{ width: `${available && occupancy !== null ? Math.max(0, Math.min(100, occupancy)) : 0}%` }}
        />
      </div>

      <dl className="grid gap-3 text-sm">
        <HealthDetail
          color="bg-status-success"
          label="Capacidade estimada da agenda"
          value={available ? formatMinutes(capacity) : "-"}
        />
        <HealthDetail
          color="bg-brand-primary"
          label="Receita contratada no mês"
          value={contracted !== null ? formatCurrency(contracted) : "-"}
        />
        <HealthDetail
          color="bg-status-warning"
          label="Potencial estimado disponível"
          value={available ? formatCurrency(agenda?.expectedPotentialCents ?? 0) : "-"}
        />
      </dl>

      <p className="flex items-start gap-3 rounded-xl bg-status-warningBg px-4 py-3 text-sm font-semibold leading-6 text-tesText-secondary">
        <Lightbulb aria-hidden="true" className="mt-0.5 shrink-0 text-status-warning" size={20} />
        Preencha os horários disponíveis para ampliar seu potencial estimado no período. O potencial é uma estimativa e não representa receita garantida.
      </p>
    </section>
  );
}

function OccupancyDonut({
  occupancy,
  reference,
}: {
  occupancy: number | null | undefined;
  reference: boolean;
}) {
  const normalized = Math.max(0, Math.min(100, occupancy ?? 0));
  return (
    <div
      aria-label={
        reference
          ? "Ocupação da agenda ainda sem base suficiente"
          : `Ocupação da agenda: ${formatPercent(normalized)}`
      }
      className="relative mx-auto grid size-[148px] place-items-center rounded-full"
      role="img"
      style={{
        background: reference
          ? "conic-gradient(var(--tes-color-brand-lavender) 0 100%)"
          : `conic-gradient(var(--tes-color-status-success) 0 ${Math.max(0, normalized - 12)}%, var(--tes-color-brand-primary) ${Math.max(0, normalized - 12)}% ${normalized}%, var(--tes-color-brand-lavender) ${normalized}% 100%)`,
      }}
      tabIndex={0}
    >
      <span className="grid size-[106px] place-items-center rounded-full bg-white px-2 text-center">
        <strong className="tabular-nums text-2xl font-extrabold text-brand-deep">
          {reference ? "-" : formatPercent(normalized)}
        </strong>
        <span className="text-xs font-semibold text-tesText-secondary">
          Ocupação
        </span>
      </span>
    </div>
  );
}

function HealthDetail({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${color}`} />
      <dt className="min-w-0 font-semibold text-tesText-secondary">{label}</dt>
      <dd className="whitespace-nowrap font-extrabold tabular-nums text-brand-deep">
        {value}
      </dd>
    </div>
  );
}

function TherapyRankingCard({
  metrics,
}: {
  metrics: TherapistFinancialMetrics | null;
}) {
  if (!metrics) {
    return (
      <TherapistLockedCard
        description="Compare o movimento das suas terapias e entenda quais caminhos têm recebido mais procura."
        requiredPlan={TherapistPlan.Premium}
        title="Terapias que mais faturam"
        variant="section"
      />
    );
  }

  const therapies = metrics.revenueByTherapy.slice(0, 5);

  return (
    <section className="grid min-h-[382px] content-start gap-5 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <Sparkles aria-hidden="true" size={20} />
          </span>
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-brand-deep">
            Estratégico
          </h2>
        </div>
        <FinancialInfoTooltip
          align="end"
          label="Estratégico"
          text="O ranking considera a receita líquida e o ticket médio das sessões pagas no período selecionado."
        />
      </div>

      {therapies.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left">
            <caption className="mb-3 text-left text-sm font-extrabold text-brand-deep">
              Terapias que mais faturam
            </caption>
            <thead className="border-b border-brand-lavender text-[11px] font-extrabold uppercase tracking-[0.04em] text-tesText-muted">
              <tr>
                <th className="w-8 pb-2 font-inherit">#</th>
                <th className="pb-2 font-inherit">Terapia</th>
                <th className="pb-2 text-right font-inherit">Receita líquida</th>
                <th className="pb-2 text-right font-inherit">Ticket médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-lavender/80">
              {therapies.map((therapy, index) => (
                <tr key={therapy.therapyId ?? therapy.therapyNameSnapshot}>
                  <td className="py-2.5 text-sm font-extrabold text-brand-primary">
                    {index + 1}
                  </td>
                  <td className="max-w-[190px] truncate py-2.5 pr-3 text-sm font-bold text-brand-deep">
                    {therapy.therapyNameSnapshot}
                  </td>
                  <td className="py-2.5 text-right text-sm font-extrabold tabular-nums text-brand-deep">
                    {formatCurrency(therapy.therapistNetAmountCents)}
                  </td>
                  <td className="py-2.5 pl-4 text-right text-sm font-extrabold tabular-nums text-brand-deep">
                    {therapy.averageTicketCents === null
                      ? "-"
                      : formatCurrency(therapy.averageTicketCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ReferenceBars message="O ranking será preenchido quando houver recebimentos confirmados." />
      )}

    </section>
  );
}

function OpportunityOfMonth({
  advanced,
}: {
  advanced: TherapistFinanceAdvancedAccess;
}) {
  if (advanced.status === "locked") {
    return (
      <TherapistLockedCard
        description="A disponibilidade da agenda e uma leitura contextualizada podem ajudar você a escolher o próximo passo da sua prática."
        requiredPlan={TherapistPlan.PremiumPlus}
        title="Crescimento"
        variant="section"
      />
    );
  }

  const dashboard = advanced.dashboard;
  const agenda = dashboard.agendaPotential;
  const available = agenda.status === "available";
  const occupancy = available ? agenda.occupancyRate : null;
  const availability = occupancy === null ? null : Math.max(0, 100 - occupancy);
  const opportunity =
    dashboard.opportunities.status === "available"
      ? dashboard.opportunities.primary
      : null;

  return (
    <section className="grid min-h-[430px] content-start gap-4 rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-brand-deep">
            Crescimento
          </h2>
          <FinancialInfoTooltip
            label="Crescimento"
            text="A disponibilidade da agenda e o potencial mostrado aqui são leituras de apoio. Potencial não é receita garantida."
          />
        </div>
      </div>

      <div className="rounded-xl bg-status-dangerBg px-4 py-4">
        <p className="text-sm font-extrabold text-brand-deep">
          Potencial estimado não utilizado
        </p>
        <p className="mt-3 tabular-nums text-[27px] font-extrabold leading-none tracking-[-0.035em] text-status-danger">
          {available ? formatCurrency(agenda.expectedPotentialCents) : "-"}
        </p>
        <p className="mt-3 text-sm font-semibold leading-5 text-status-danger">
          {availability === null
            ? "Aguardando base suficiente"
            : `${formatPercent(availability)} da agenda permanece disponível`}
        </p>
      </div>

      <div className="rounded-xl bg-status-warningBg px-4 py-4">
        <p className="text-sm font-extrabold text-brand-deep">Disponibilidade na agenda</p>
        <p className="mt-3 tabular-nums text-[27px] font-extrabold leading-none tracking-[-0.035em] text-status-warning">
          {availability === null ? "-" : formatPercent(availability)}
        </p>
        <p className="mt-3 text-sm font-semibold leading-5 text-status-warning">
          {available
            ? `${formatMinutes(agenda.availableMinutes)} livres no período`
            : "Aguardando base suficiente"}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-brand-lavenderSoft/80 px-4 py-4">
        <Lightbulb aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={24} />
        <div>
          <p className="text-sm font-semibold leading-5 text-tesText-secondary">
            {opportunity?.description ?? "Preencha horários disponíveis para criar mais oportunidades de atendimento."}
          </p>
          {opportunity && opportunity.estimatedImpactCents !== null ? (
            <p className="mt-2 text-sm font-extrabold text-brand-deep">
              Impacto estimado: {formatCurrency(opportunity.estimatedImpactCents)}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-auto border-t border-brand-lavender/80 pt-4 text-sm font-semibold leading-6 text-tesText-secondary">
        Acompanhe a disponibilidade ao longo do período para interpretar a
        oportunidade com contexto.
      </p>
    </section>
  );
}

function FinancialEvolutionCard({
  advanced,
  metrics,
  overview,
}: {
  advanced: TherapistAdvancedFinancialDashboard | null;
  metrics: TherapistFinancialMetrics | null;
  overview: TherapistFinancialOverview;
}) {
  const hasFinancialData = hasOverviewFinancialData(overview);
  if (!advanced && !metrics) {
    return (
      <TherapistLockedCard
        description="Veja a evolução dos seus recebimentos quando essa leitura fizer parte do seu plano."
        requiredPlan={TherapistPlan.Premium}
        title="Evolução financeira"
        variant="section"
      />
    );
  }

  if (advanced?.financialEvolution.length) {
    return (
      <FinancialEvolutionChart
        emptyMessage="A evolução avançada aparece quando houver uma base suficiente para comparar realizado, contratado e estimado."
        footer={getEvolutionFooter(
          advanced.financialEvolution.map((point) => point.realizedNetCents),
        )}
        highlights={[
          {
            color: "var(--tes-color-brand-primary)",
            label: "Realizado líquido",
            value: formatCurrency(advanced.forecast.realizedNetCents),
          },
          {
            color: "var(--tes-color-brand-primaryHover)",
            label: "Receita contratada",
            value: formatCurrency(advanced.forecast.contractedMonthNetCents),
          },
          {
            color: "var(--tes-color-brand-lavender)",
            label: "Potencial estimado",
            value: formatCurrency(
              advanced.forecast.estimatedOpenAgendaPotentialCents,
            ),
          },
        ]}
        points={advanced.financialEvolution.map((point) => ({
          contracted: point.contractedNetCents,
          current: point.realizedNetCents,
          label: formatShortDate(point.periodStart),
          previous: point.previousPeriodNetCents,
          projected: point.projectedNetCents,
        }))}
        series={[
          {
            color: "var(--tes-color-brand-primary)",
            dataKey: "current",
            label: "Realizado",
            type: "bar",
          },
          {
            color: "var(--tes-color-brand-primaryHover)",
            dataKey: "contracted",
            label: "Contratado",
            type: "bar",
          },
          {
            color: "var(--tes-color-brand-lavender)",
            dataKey: "projected",
            label: "Estimado",
            type: "line",
          },
          {
            color: "var(--tes-color-brand-primaryPressed)",
            dataKey: "previous",
            label: "Período anterior",
            type: "line",
          },
        ]}
      />
    );
  }

  const highlights: FinancialEvolutionHighlight[] = [
    {
      color: "var(--tes-color-brand-primary)",
      label: "Receita líquida",
      value: formatCurrencyOrDash(overview.therapistNetCents, hasFinancialData),
    },
    {
      color: "var(--tes-color-brand-primaryHover)",
      label: "Receita bruta",
      value: formatCurrencyOrDash(overview.grossPaidCents, hasFinancialData),
    },
    {
      color: "var(--tes-color-brand-lavender)",
      label: "Custos da plataforma",
      value: hasFinancialData
        ? formatCurrency(overview.tesCommissionCents)
        : "-",
    },
  ];

  return (
    <FinancialEvolutionChart
      emptyMessage="A evolução aparece assim que houver recebimentos confirmados no período."
      footer={getEvolutionFooter(
        metrics?.financialEvolution.map(
          (point) => point.therapistNetAmountCents,
        ) ?? [],
      )}
      highlights={highlights}
      points={
        metrics?.financialEvolution.map((point) => ({
          current: point.therapistNetAmountCents,
          gross: point.grossAmountCents,
          label: formatShortDate(point.periodStart),
          previous: point.previousPeriodNetAmountCents,
        })) ?? []
      }
      series={[
        {
          color: "var(--tes-color-brand-primary)",
          dataKey: "current",
          label: "Receita líquida",
          type: "bar",
        },
        {
          color: "var(--tes-color-brand-primaryHover)",
          dataKey: "gross",
          label: "Receita bruta",
          type: "bar",
        },
        {
          color: "var(--tes-color-brand-lavender)",
          dataKey: "previous",
          label: "Período anterior",
          type: "line",
        },
      ]}
    />
  );
}

function FinancialMethodology({
  advanced,
  generatedAt,
  timezone,
}: {
  advanced: TherapistFinanceAdvancedAccess;
  generatedAt: string;
  timezone: string;
}) {
  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[34px]">
          Detalhes e metodologia
        </h2>
        <p className="mt-1 text-sm font-semibold text-tesText-secondary">
          Atualizado em {formatDateTime(generatedAt, timezone)}.
        </p>
      </div>

      <div className="divide-y divide-brand-lavender rounded-card border border-brand-lavender bg-white shadow-card">
        <MethodologyRow
          description="Entenda como recebimentos, custos da plataforma e reembolsos formam o valor líquido."
          icon={CircleDollarSign}
          title="Como o valor é composto"
        >
          O valor líquido considera o bruto das sessões, os custos da plataforma e os
          reembolsos ao cliente confirmados no período.
        </MethodologyRow>
        <MethodologyRow
          description="Veja o que distingue valores realizados, contratados e estimados."
          icon={TrendingUp}
          title="Como a previsão do mês é calculada"
        >
          {advanced.status === "available"
            ? "A previsão separa o que já foi realizado, sessões futuras já contratadas e o potencial estimado da agenda. Potencial não é receita garantida."
            : "A previsão avançada fica disponível no Premium Plus e sempre separa valores confirmados de estimativas."}
        </MethodologyRow>
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-xs font-semibold text-tesText-muted">
        <CheckCircle2 aria-hidden="true" size={15} />
        Seus dados financeiros são apresentados com segurança e privacidade.
      </p>
    </section>
  );
}

function MethodologyRow({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: string;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <details className="group">
      <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary [&::-webkit-details-marker]:hidden sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm font-extrabold text-brand-deep">
            {title}
          </strong>
          <span className="mt-1 block text-sm font-semibold leading-5 text-tesText-secondary">
            {description}
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="shrink-0 text-brand-primary transition-transform group-open:rotate-90"
          size={19}
        />
      </summary>
      <p className="border-t border-brand-lavender px-4 py-4 text-sm font-semibold leading-6 text-tesText-secondary sm:px-5">
        {children}
      </p>
    </details>
  );
}

function ReferenceBars({ message }: { message: string }) {
  return (
    <div className="grid gap-3 rounded-xl bg-surface-soft px-4 py-4">
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
      <div aria-hidden="true" className="grid gap-2">
        <span className="h-2 w-full rounded-full bg-brand-lavender" />
        <span className="h-2 w-4/5 rounded-full bg-brand-lavender" />
      </div>
    </div>
  );
}

function forecastProgressLabel(
  forecast: TherapistAdvancedFinancialDashboard["forecast"],
) {
  if (forecast.contractedMonthNetCents <= 0) return "Sem receita contratada";
  const progress = Math.max(
    0,
    Math.min(
      100,
      (forecast.realizedNetCents / forecast.contractedMonthNetCents) * 100,
    ),
  );
  return `${formatPercent(progress, 0)} do contratado já realizado`;
}

function getEvolutionFooter(values: number[]) {
  const usable = values.filter((value) => value > 0);
  if (usable.length < 2) {
    return "A evolução será comparada quando houver mais de um período com recebimentos confirmados.";
  }
  const first = usable[0];
  const last = usable[usable.length - 1];
  if (last > first) {
    return "Tendência positiva na sequência observada: a receita líquida aumentou entre os períodos com base disponível.";
  }
  if (last < first) {
    return "A receita líquida variou na sequência observada. Consulte os períodos para interpretar a mudança com contexto.";
  }
  return "A receita líquida permaneceu estável na sequência observada.";
}

function formatShortDate(value: string) {
  const formatted = formatDate(value);
  return formatted.slice(0, 5);
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
}
