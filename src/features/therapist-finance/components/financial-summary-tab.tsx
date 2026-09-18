import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Info,
  Lightbulb,
  Ticket,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { TherapistPlan } from "@/domain/tes";
import { TherapistLockedCard } from "@/features/therapist-access";
import type {
  FinancialMetricComparison,
  TherapistAdvancedFinancialDashboard,
  TherapistFinanceAdvancedAccess,
  TherapistFinanceAnalyticsAccess,
  TherapistFinancialMetrics,
  TherapistFinancialOverview,
  TherapistPayoutsContract,
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
  payouts,
}: {
  advanced: TherapistFinanceAdvancedAccess;
  analytics: TherapistFinanceAnalyticsAccess;
  overview: TherapistFinancialOverview;
  payouts: TherapistPayoutsContract;
}) {
  const metrics = analytics.status === "available" ? analytics.metrics : null;
  const dashboard = advanced.status === "available" ? advanced.dashboard : null;
  const receivable = payouts.summary.expectedCents;
  const hasFinancialData = hasOverviewFinancialData(overview);
  const hasMetricsData =
    metrics !== null &&
    (metrics.revenue.paidSessionCount > 0 ||
      metrics.sessions.completedCount > 0 ||
      metrics.sessions.cancelledCount > 0 ||
      metrics.sessions.rescheduledCount > 0);

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
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
            <FinancialKpiCard
              accent="green"
              comparison={metrics?.revenue.comparison.therapistNet}
              helpText="É o valor que pertence a você após os custos da plataforma e os reembolsos confirmados, quando houver."
              icon={CircleDollarSign}
              label="Receita líquida"
              valueNote="No período selecionado"
              value={formatCurrencyOrDash(
                overview.therapistNetCents,
                hasFinancialData,
              )}
            />
            <FinancialKpiCard
              accent="blue"
              helpText="Mostra os valores previstos para os próximos repasses e os que ainda não têm uma data bancária confirmada."
              icon={WalletCards}
              label="A receber"
              status={
                receivable === 0
                  ? "Sem valores previstos"
                  : "Acompanhando os próximos repasses"
              }
              valueNote="Valores previstos para chegar"
              value={formatCurrency(receivable)}
            />
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
            />
            <FinancialKpiCard
              accent="cyan"
              helpText="Conta as sessões concluídas ou confirmadas no período selecionado."
              icon={CalendarDays}
              label="Sessões concluídas"
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
        aria-label="Visão financeira"
        className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] [&>*]:min-w-0"
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
        <FinancialEvolutionCard
          advanced={dashboard}
          metrics={metrics}
          overview={overview}
        />
      </section>

      <section
        aria-label="Agenda e receitas"
        className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] [&>*]:min-w-0"
      >
        {advanced.status === "locked" ? (
          <TherapistLockedCard
            description="Uma leitura avançada pode ajudar no planejamento da sua agenda, sem misturar estimativa com receita garantida."
            requiredPlan={TherapistPlan.PremiumPlus}
            title="Agenda e potencial"
            variant="section"
          />
        ) : (
          <AgendaPotentialPanel advanced={advanced} />
        )}
        <TherapyRankingCard metrics={metrics} />
      </section>

      <FinancialMethodology
        advanced={advanced}
        generatedAt={overview.generatedAt}
        timezone={overview.timezone}
      />
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
    overview.payoutProcessingCents > 0 ||
    overview.waitingSettlementCents > 0
  );
}

function FinancialKpiCard({
  accent,
  comparison,
  helpText,
  icon: Icon,
  label,
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
    <article className="grid min-h-[176px] content-start gap-4 rounded-card border border-brand-lavender bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-full ${accentClasses[accent]}`}
          >
            <Icon aria-hidden="true" size={21} />
          </span>
          <h3 className="text-sm font-extrabold text-brand-deep">{label}</h3>
        </div>
        <FinancialInfoTooltip align="end" label={label} text={helpText} />
      </div>
      <div>
        <p
          className={`break-words tabular-nums text-[27px] font-extrabold leading-none tracking-[-0.035em] sm:text-[31px] ${tone === "muted" ? "text-tesText-muted" : "text-brand-deep"}`}
        >
          {value}
        </p>
        <p className="mt-2 text-sm font-semibold leading-5 text-tesText-secondary">
          {valueNote}
        </p>
      </div>
      <div className="self-start">
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
  const dashboard = advanced.status === "available" ? advanced.dashboard : null;
  const agenda = dashboard?.agendaPotential ?? null;
  const available = agenda?.status === "available";
  const occupancy = available ? agenda?.occupancyRate : null;
  const opportunity =
    dashboard?.opportunities.status === "available"
      ? dashboard.opportunities.primary
      : null;

  return (
    <section className="grid min-h-[382px] content-start gap-5 rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-xl font-extrabold tracking-[-0.02em] text-brand-deep">
            Agenda e potencial
          </h2>
          <FinancialInfoTooltip
            label="Agenda e potencial"
            text="A ocupação usa a agenda disponível no período. Os valores de potencial são estimativas e não representam receita garantida."
          />
        </div>
      </div>

      <div className="rounded-xl bg-surface-soft px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-extrabold text-brand-deep">Ocupação da agenda</p>
          <strong className="tabular-nums text-xl font-extrabold text-brand-deep">
            {available && occupancy !== null ? formatPercent(occupancy) : "-"}
          </strong>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-brand-lavenderSoft">
          <span
            aria-hidden="true"
            className="block h-full rounded-full bg-brand-primary"
            style={{ width: `${available && occupancy !== null ? Math.max(0, Math.min(100, occupancy)) : 0}%` }}
          />
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <AgendaDetail
          label="Horas comprometidas"
          value={available ? formatMinutes(agenda?.committedMinutes ?? 0) : "-"}
        />
        <AgendaDetail
          label="Horas livres no período"
          value={available ? formatMinutes(agenda?.availableMinutes ?? 0) : "-"}
        />
      </dl>

      <div className="rounded-xl bg-status-warningBg px-4 py-4">
        <p className="text-sm font-extrabold text-brand-deep">
          Potencial estimado da agenda
        </p>
        <p className="mt-2 tabular-nums text-[27px] font-extrabold leading-none tracking-[-0.035em] text-status-warning">
          {available ? formatCurrency(agenda?.expectedPotentialCents ?? 0) : "-"}
        </p>
        <p className="mt-2 text-sm font-semibold leading-5 text-tesText-secondary">
          {agendaCapacityMessage(agenda)} Potencial é uma estimativa e não
          representa receita garantida.
        </p>
      </div>

      <p className="flex items-start gap-3 rounded-xl bg-brand-lavenderSoft/70 px-4 py-3 text-sm font-semibold leading-6 text-tesText-secondary">
        <Lightbulb aria-hidden="true" className="mt-0.5 shrink-0 text-status-warning" size={20} />
        {opportunity?.description ?? (agenda?.reason === "no_active_services"
          ? "Ative uma terapia para estimar o potencial dos horários já configurados. O potencial é uma estimativa e não representa receita garantida."
          : "Os horários disponíveis ajudam a estimar o potencial do período. O potencial é uma estimativa e não representa receita garantida.")}
      </p>
    </section>
  );
}

function AgendaDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-brand-lavender/80 bg-white px-3 py-3">
      <dt className="text-sm font-semibold text-tesText-secondary">{label}</dt>
      <dd className="mt-1 whitespace-nowrap text-lg font-extrabold tabular-nums text-brand-deep">
        {value}
      </dd>
    </div>
  );
}

function agendaCapacityMessage(
  agenda: TherapistAdvancedFinancialDashboard["agendaPotential"] | null,
) {
  if (!agenda) return "Leitura da agenda indisponível no momento";
  if (agenda.status === "available") {
    if (agenda.reason === "no_active_services") {
      return "Há horários configurados, mas falta uma terapia ativa para estimar o potencial";
    }
    return `${formatMinutes(agenda.committedMinutes)} já comprometidos no período`;
  }
  if (agenda.reason === "no_availability_rules") {
    return "Sem horários configurados para o restante do mês";
  }
  return "Não foi possível calcular a ocupação da agenda neste período";
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
        title="Terapias com maior receita"
        variant="section"
      />
    );
  }

  const therapies = metrics.revenueByTherapy.slice(0, 5);

  return (
    <section className="grid min-h-[382px] content-start gap-5 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-brand-deep">
            Terapias com maior receita
          </h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
            Receita líquida no período selecionado.
          </p>
        </div>
        <FinancialInfoTooltip
          align="end"
          label="Terapias com maior receita"
          text="O ranking considera a receita líquida das sessões pagas no período selecionado."
        />
      </div>

      {therapies.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left">
            <thead className="border-b border-brand-lavender text-[11px] font-extrabold uppercase tracking-[0.04em] text-tesText-muted">
              <tr>
                <th className="w-8 pb-2 font-inherit">#</th>
                <th className="pb-2 font-inherit">Terapia</th>
                <th className="pb-2 text-right font-inherit">Receita líquida</th>
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
        emptyMessage="A evolução aparece quando houver uma base suficiente para comparar realizado, contratado e o período anterior."
        footer={getEvolutionFooter(
          advanced.financialEvolution.map((point) => point.realizedNetCents),
        )}
        highlights={[
          {
            color: "var(--tes-color-brand-primaryHover)",
            label: "Receita contratada do mês",
            value:
              advanced.forecast.status === "available"
                ? formatCurrency(advanced.forecast.contractedMonthNetCents)
                : "-",
          },
          {
            color: "var(--tes-color-status-success)",
            label: "Variação vs período anterior",
            value: formatPercentageComparison(
              metrics?.revenue.comparison.therapistNet,
            ),
          },
        ]}
        points={advanced.financialEvolution.map((point) => ({
          contracted: point.contractedNetCents,
          current: point.realizedNetCents,
          label: formatShortDate(point.periodStart),
          previous: point.previousPeriodNetCents,
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
    <footer className="rounded-card border border-brand-lavender bg-white px-4 py-4 shadow-card sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-brand-deep">
            Como calculamos estes indicadores
          </h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
            O valor líquido considera o bruto, os custos da plataforma e os reembolsos confirmados.
          </p>
        </div>
        <p className="shrink-0 text-xs font-semibold text-tesText-muted">
          Atualizado em {formatDateTime(generatedAt, timezone)}.
        </p>
      </div>
      <p className="mt-3 border-t border-brand-lavender pt-3 text-xs font-semibold leading-5 text-tesText-secondary">
        {advanced.status === "available"
          ? "Receita contratada reúne o realizado e sessões futuras já pagas; o potencial da agenda é uma estimativa, não uma receita garantida."
          : "As estimativas de receita e potencial da agenda são exibidas somente quando estiverem disponíveis no seu plano."}
      </p>
    </footer>
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

function formatPercentageComparison(
  comparison: FinancialMetricComparison | undefined,
) {
  if (
    !comparison ||
    comparison.comparisonStatus !== "available" ||
    comparison.percentageDelta === null
  ) {
    return "Sem base comparável";
  }

  const prefix = comparison.percentageDelta > 0 ? "+" : "";
  return `${prefix}${formatPercent(comparison.percentageDelta)}`;
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
