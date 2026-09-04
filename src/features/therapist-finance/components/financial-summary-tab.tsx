import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Info,
  Target,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { TherapistPlan } from "@/domain/tes";
import { TherapistLockedCard } from "@/features/therapist-access";
import { routes } from "@/lib/routes";

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

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <section
        aria-label="Panorama financeiro"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0"
      >
        {analytics.status === "locked" ? (
          <TherapistLockedCard
            className="sm:col-span-2 xl:col-span-4"
            description="Indicadores e acompanhamento financeiro ficam disponíveis no Premium, quando fizer sentido para o momento da sua prática."
            requiredPlan={TherapistPlan.Premium}
            title="Panorama financeiro"
            variant="section"
          />
        ) : (
          <>
            <FinancialKpiCard
              comparison={metrics?.revenue.comparison.therapistNet}
              description="Valor que pertence a você após comissão e reembolsos aplicáveis."
              icon={CircleDollarSign}
              label="Receita líquida"
              value={formatCurrencyOrDash(
                overview.therapistNetCents,
                hasFinancialData,
              )}
            />
            <FinancialKpiCard
              description="Valores em confirmação, período de segurança ou processamento."
              icon={WalletCards}
              label="A receber"
              status={
                !hasFinancialData
                  ? "Sem dados"
                  : receivable === 0
                    ? "Sem pendências"
                    : "Acompanhando o próximo repasse"
              }
              value={formatCurrencyOrDash(receivable, hasFinancialData)}
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
                description="Receita contratada no mês. O potencial estimado fica separado."
                icon={TrendingUp}
                label="Previsto no mês"
                status={
                  forecastAvailable && forecast
                    ? forecastProgressLabel(forecast)
                    : "Aguardando base suficiente"
                }
                tone={forecastAvailable ? "success" : "muted"}
                value={
                  forecastAvailable && forecast
                    ? formatCurrency(forecast.contractedMonthNetCents)
                    : "-"
                }
              />
            )}
            <FinancialKpiCard
              description="Sessões concluídas ou confirmadas no período consultado."
              icon={CalendarDays}
              label="Sessões realizadas"
              status={
                metrics
                  ? hasMetricsData
                    ? `${formatInteger(metrics.sessions.completedCount)} no período`
                    : "Sem dados no período"
                  : "Disponível no Premium"
              }
              tone={metrics ? "success" : "muted"}
              value={
                metrics
                  ? formatIntegerOrDash(
                      metrics.sessions.completedCount,
                      hasMetricsData,
                    )
                  : "-"
              }
            />
          </>
        )}
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] [&>*]:min-w-0">
        {analytics.status === "locked" ? (
          <TherapistLockedCard
            description="Acompanhe a composição e a evolução dos seus recebimentos com uma visão mais completa."
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
            title="Sua agenda e potencial"
            variant="section"
          />
        ) : (
          <AgendaPotentialPanel advanced={advanced} />
        )}
      </div>

      <section
        aria-label="Leituras complementares"
        className="grid min-w-0 gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.82fr)_minmax(0,1.36fr)] [&>*]:min-w-0"
      >
        <TherapyRankingCard metrics={metrics} />
        <AverageTicketCard metrics={metrics} />
        <OpportunityOfMonth advanced={advanced} />
      </section>

      <FinancialEvolutionCard
        advanced={dashboard}
        metrics={metrics}
        overview={overview}
      />

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
    overview.payoutProcessingCents > 0
  );
}

function FinancialKpiCard({
  comparison,
  description,
  icon: Icon,
  label,
  status,
  tone = "default",
  value,
}: {
  comparison?: FinancialMetricComparison;
  description: string;
  icon: LucideIcon;
  label: string;
  status?: string;
  tone?: "default" | "muted" | "success";
  value: string;
}) {
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

  return (
    <article className="grid min-h-[188px] grid-rows-[auto_1fr_auto] rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" size={21} />
        </span>
        <h2 className="text-sm font-extrabold text-brand-deep">{label}</h2>
      </div>
      <div className="mt-5">
        <p
          className={`tabular-nums text-[28px] font-extrabold leading-none sm:text-[30px] ${tone === "muted" ? "text-tesText-muted" : "text-brand-deep"}`}
        >
          {value}
        </p>
        <p className={`mt-3 text-sm font-extrabold ${statusClass}`}>
          {statusText}
        </p>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
        {description}
      </p>
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
      note: "Antes de comissão e reembolsos",
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
    <section className="grid gap-5 rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-extrabold text-brand-deep">Seu dinheiro</h2>
        <Info aria-hidden="true" className="text-tesText-muted" size={16} />
      </div>

      <dl className="grid divide-y divide-brand-lavender/80">
        {rows.map((row, index) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-3 first:pt-0 last:pb-0"
            key={row.label}
          >
            <dt className="flex min-w-0 gap-3">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${row.color}`}
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
                <span className="mt-0.5 block text-xs font-semibold leading-5 text-tesText-secondary">
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
  const agendaHref =
    advanced.status === "locked"
      ? routes.therapist.plan
      : routes.therapist.agenda;
  const actionLabel =
    advanced.status === "locked" ? "Conhecer Premium Plus" : "Ver agenda";

  return (
    <section className="grid gap-5 rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-extrabold text-brand-deep">
          Sua agenda e potencial
        </h2>
        <Info aria-hidden="true" className="text-tesText-muted" size={16} />
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(150px,0.82fr)_minmax(0,1fr)] sm:items-center">
        <OccupancyDonut occupancy={occupancy} reference={!available} />
        <div className="grid gap-5">
          <AgendaStat
            icon={Clock3}
            label="Horas disponíveis estimadas"
            value={
              available ? formatMinutes(agenda?.availableMinutes ?? 0) : "-"
            }
          />
          <AgendaStat
            icon={TrendingUp}
            label="Potencial estimado no mês"
            value={
              available
                ? formatCurrency(agenda?.expectedPotentialCents ?? 0)
                : "-"
            }
          />
        </div>
      </div>

      <div className="border-t border-brand-lavender pt-4">
        <p className="text-sm font-extrabold text-brand-deep">
          {available && occupancy !== null
            ? `Ocupação atual: ${formatPercent(occupancy)}.`
            : advanced.status === "locked"
              ? "Uma leitura avançada da agenda pode ajudar no planejamento."
              : "A ocupação aparecerá quando houver uma base de agenda suficiente."}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {available
            ? "O potencial é uma estimativa explicável; ele não representa receita garantida."
            : "A disponibilidade continua acessível na agenda; esta leitura é complementar."}
        </p>
      </div>

      <Link
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={agendaHref}
      >
        <CalendarDays aria-hidden="true" size={18} />
        {actionLabel}
      </Link>
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
      className="relative mx-auto grid size-[156px] place-items-center rounded-full"
      role="img"
      style={{
        background: reference
          ? "conic-gradient(var(--tes-color-brand-lavender) 0 100%)"
          : `conic-gradient(var(--tes-color-brand-primary) 0 ${normalized}%, var(--tes-color-brand-lavender) ${normalized}% 100%)`,
      }}
      tabIndex={0}
    >
      <span className="grid size-[112px] place-items-center rounded-full bg-white px-2 text-center">
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

function AgendaStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3">
      <span className="grid size-8 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={16} />
      </span>
      <div>
        <p className="text-xs font-extrabold leading-5 text-brand-deep">
          {label}
        </p>
        <p className="mt-1 text-lg font-extrabold tabular-nums text-brand-deep">
          {value}
        </p>
      </div>
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

  const therapies = metrics?.revenueByTherapy.slice(0, 2) ?? [];
  const max = Math.max(
    1,
    ...therapies.map((therapy) => therapy.therapistNetAmountCents),
  );

  return (
    <section className="grid min-h-[288px] content-start gap-5 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-extrabold text-brand-deep">
          Terapias que mais faturam
        </h2>
        <Info aria-hidden="true" className="text-tesText-muted" size={15} />
      </div>

      {therapies.length ? (
        <ol className="grid gap-4">
          {therapies.map((therapy, index) => (
            <li
              className="grid grid-cols-[32px_minmax(0,1fr)] gap-3"
              key={therapy.therapyId ?? therapy.therapyNameSnapshot}
            >
              <span
                className={`grid size-8 place-items-center rounded-full text-sm font-extrabold ${index === 0 ? "bg-brand-lavenderSoft text-brand-primary" : "bg-status-successBg text-status-success"}`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-extrabold text-brand-deep">
                    {therapy.therapyNameSnapshot}
                  </p>
                  <p className="shrink-0 text-sm font-extrabold tabular-nums text-brand-deep">
                    {formatCurrency(therapy.therapistNetAmountCents)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-tesText-secondary">
                  {formatInteger(therapy.paidSessionCount)} sessões pagas
                </p>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-brand-lavenderSoft">
                  <span
                    className={`block h-full rounded-full ${index === 0 ? "bg-brand-primary" : "bg-status-success"}`}
                    style={{
                      width: `${Math.max(8, (therapy.therapistNetAmountCents / max) * 100)}%`,
                    }}
                  />
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ReferenceBars message="O ranking será preenchido quando houver recebimentos confirmados." />
      )}

      <Link
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.services}
      >
        Ver suas terapias <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </section>
  );
}

function AverageTicketCard({
  metrics,
}: {
  metrics: TherapistFinancialMetrics | null;
}) {
  if (!metrics) {
    return (
      <TherapistLockedCard
        description="Acompanhe o valor médio líquido por sessão quando você quiser olhar para os seus padrões com mais clareza."
        requiredPlan={TherapistPlan.Premium}
        title="Ticket médio"
        variant="section"
      />
    );
  }

  const ticket = metrics?.revenue.netAverageTicketCents ?? null;
  const comparison = metrics?.revenue.comparison.averageTicket;

  return (
    <section className="grid min-h-[288px] content-start gap-5 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-extrabold text-brand-deep">Ticket médio</h2>
        <Info aria-hidden="true" className="text-tesText-muted" size={15} />
      </div>
      <div>
        <p
          className={`text-[30px] font-extrabold tabular-nums ${ticket === null ? "text-tesText-muted" : "text-brand-deep"}`}
        >
          {ticket === null ? "Sem dados" : formatCurrency(ticket)}
        </p>
        <p
          className={`mt-3 text-sm font-extrabold ${comparison && comparison.comparisonStatus !== "available" ? "text-tesText-muted" : comparison && comparison.absoluteDelta !== null && comparison.absoluteDelta < 0 ? "text-status-danger" : "text-status-success"}`}
        >
          {comparison
            ? formatComparison(comparison, { formatter: formatCurrency })
            : "Disponível no Premium"}
        </p>
      </div>
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        {metrics
          ? `Média líquida baseada em ${formatInteger(metrics.revenue.paidSessionCount)} sessões pagas no período.`
          : "Acompanhe o valor médio líquido por sessão com o Premium."}
      </p>
      {metrics ? (
        <p className="border-t border-brand-lavender pt-4 text-sm font-semibold text-tesText-secondary">
          Ticket bruto:{" "}
          <strong className="font-extrabold text-brand-deep">
            {metrics.revenue.grossAverageTicketCents === null
              ? "Sem dados"
              : formatCurrency(metrics.revenue.grossAverageTicketCents)}
          </strong>
        </p>
      ) : null}
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
        description="Uma leitura contextualizada pode ajudar você a escolher o próximo passo da sua prática."
        requiredPlan={TherapistPlan.PremiumPlus}
        title="Oportunidade do mês"
        variant="section"
      />
    );
  }

  const opportunity =
    advanced.dashboard.opportunities.status === "available"
      ? advanced.dashboard.opportunities.primary
      : null;

  return (
    <section className="grid min-h-[288px] content-start gap-4 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Target aria-hidden="true" size={16} />
        </span>
        <h2 className="text-lg font-extrabold text-brand-deep">
          Oportunidade do mês
        </h2>
      </div>

      {opportunity ? (
        <>
          <div>
            <p className="text-base font-extrabold leading-6 text-brand-deep">
              {opportunity.title}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              {opportunity.description}
            </p>
          </div>
          {opportunity.estimatedImpactCents !== null ? (
            <p className="rounded-lg bg-brand-lavenderSoft/60 px-3 py-2 text-sm font-semibold text-tesText-secondary">
              Impacto estimado:{" "}
              <strong className="font-extrabold text-brand-deep">
                {formatCurrency(opportunity.estimatedImpactCents)}
              </strong>
            </p>
          ) : null}
          <Link
            className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={opportunityActionHref(opportunity.action)}
          >
            Abrir ação sugerida <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            Vamos mostrar uma sugestão quando houver base suficiente para uma
            leitura confiável.
          </p>
          <span className="mt-auto inline-flex min-h-11 items-center text-sm font-extrabold text-tesText-muted">
            Acompanhando seus dados
          </span>
        </>
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
            color: "var(--tes-color-status-info)",
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
            color: "var(--tes-color-status-info)",
            dataKey: "contracted",
            label: "Contratado",
            type: "bar",
          },
          {
            color: "var(--tes-color-brand-deep)",
            dataKey: "projected",
            label: "Estimado",
            type: "line",
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

  const highlights: FinancialEvolutionHighlight[] = [
    {
      color: "var(--tes-color-brand-primary)",
      label: "Receita líquida",
      value: formatCurrencyOrDash(overview.therapistNetCents, hasFinancialData),
    },
    {
      color: "var(--tes-color-brand-cyan)",
      label: "Receita bruta",
      value: formatCurrencyOrDash(overview.grossPaidCents, hasFinancialData),
    },
    {
      color: "var(--tes-color-status-danger)",
      label: "Comissão TES",
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
          color: "var(--tes-color-brand-cyan)",
          dataKey: "gross",
          label: "Receita bruta",
          type: "bar",
        },
        {
          color: "var(--tes-color-brand-deep)",
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
          description="Entenda como recebimentos, comissão TES e reembolsos formam o valor líquido."
          icon={CircleDollarSign}
          title="Como o valor é composto"
        >
          O valor líquido considera o bruto das sessões, a comissão TES e os
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

function opportunityActionHref(action: string): Route<string> {
  if (action === "open_agenda" || action === "review_availability")
    return routes.therapist.agenda as Route<string>;
  if (action === "review_services")
    return routes.therapist.services as Route<string>;
  if (action === "review_cancellations")
    return routes.therapist.sessions as Route<string>;
  if (action === "view_patients_without_return")
    return routes.therapist.insights as Route<string>;
  return routes.therapist.finance as Route<string>;
}
