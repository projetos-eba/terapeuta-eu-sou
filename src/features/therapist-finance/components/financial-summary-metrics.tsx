import Link from "next/link";
import {
  BarChart3,
  CalendarX2,
  LockKeyhole,
  RotateCcw,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { AppPageSection } from "@/components/app-page";
import { routes } from "@/lib/routes";

import type {
  FinancialMetricComparison,
  TherapistFinanceAnalyticsAccess,
  TherapistFinancialMetrics,
} from "../therapist-finance.types";
import {
  formatComparison,
  formatCurrency,
  formatDate,
  formatInteger,
  formatPercent,
} from "./financial-formatters";

export function FinancialSummaryMetrics({
  analytics,
}: {
  analytics: TherapistFinanceAnalyticsAccess;
}) {
  if (analytics.status === "locked") return <PremiumMetricsLocked />;

  const metrics = analytics.metrics;

  return (
    <section aria-label="Métricas financeiras Premium" className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          comparison={metrics.revenue.comparison.therapistNet}
          description="Valor líquido devido ao terapeuta no período."
          icon={TrendingUp}
          label="Receita líquida"
          value={formatCurrency(metrics.revenue.therapistNetCents)}
          valueKind="currency"
        />
        <MetricCard
          comparison={metrics.revenue.comparison.averageTicket}
          description={`Principal: ticket médio líquido. Bruto: ${
            metrics.revenue.grossAverageTicketCents === null
              ? "sem base"
              : formatCurrency(metrics.revenue.grossAverageTicketCents)
          }.`}
          icon={BarChart3}
          label="Ticket médio"
          value={
            metrics.revenue.netAverageTicketCents === null
              ? "Sem base"
              : formatCurrency(metrics.revenue.netAverageTicketCents)
          }
          valueKind="currency"
        />
        <MetricCard
          comparison={metrics.revenue.comparison.paidSessions}
          description={`${formatInteger(
            metrics.revenue.paidSessionCount,
          )} sessão(ões) com pagamento confirmado.`}
          icon={RotateCcw}
          label="Sessões realizadas"
          value={formatInteger(metrics.sessions.completedCount)}
        />
        <MetricCard
          description={`Janela de retorno: ${metrics.retention.observationWindowDays} dias. Denominador elegível: ${metrics.retention.eligiblePatients}.`}
          icon={TrendingUp}
          label="Taxa de retorno"
          muted={metrics.retention.status === "insufficient_data"}
          value={formatPercent(metrics.retention.returnRate)}
        />
      </div>

      {metrics.period.isPartial ? (
        <AppPageSection className="bg-brand-lavenderSoft/60">
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            Este período inclui o dia atual e pode mudar até o fechamento do
            dia. A comparação usa o período anterior equivalente.
          </p>
        </AppPageSection>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <CancellationRescheduleCard metrics={metrics} />
        <FinancialEvolutionCard metrics={metrics} />
      </div>

      <RevenueByTherapyCard metrics={metrics} />
    </section>
  );
}

function PremiumMetricsLocked() {
  return (
    <AppPageSection className="grid gap-4 bg-brand-lavenderSoft/70 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <span className="grid size-12 place-items-center rounded-full bg-white text-brand-primary">
        <LockKeyhole aria-hidden="true" size={22} />
      </span>
      <div>
        <h2 className="text-lg font-extrabold text-brand-deep">
          Métricas financeiras Premium
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          O resumo operacional continua disponível. Comparação com período
          anterior, ticket médio, retorno, evolução e faturamento por terapia
          fazem parte do Premium.
        </p>
      </div>
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.plan}
      >
        Ver planos
      </Link>
    </AppPageSection>
  );
}

function MetricCard({
  comparison,
  description,
  icon: Icon,
  label,
  muted = false,
  value,
  valueKind,
}: {
  comparison?: FinancialMetricComparison;
  description: string;
  icon: LucideIcon;
  label: string;
  muted?: boolean;
  value: string;
  valueKind?: "currency";
}) {
  return (
    <article className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={22} />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-brand-deep">{label}</h2>
      <p
        className={`mt-2 text-[24px] font-extrabold leading-tight ${
          muted ? "text-tesText-secondary" : "text-brand-deep"
        }`}
      >
        {value}
      </p>
      {comparison ? (
        <p className="mt-2 text-sm font-extrabold leading-6 text-brand-deep">
          {formatComparison(comparison, {
            formatter:
              valueKind === "currency"
                ? (value) => formatCurrency(value)
                : undefined,
          })}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {description}
      </p>
    </article>
  );
}

function CancellationRescheduleCard({
  metrics,
}: {
  metrics: TherapistFinancialMetrics;
}) {
  return (
    <AppPageSection className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <CalendarX2 aria-hidden="true" size={21} />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Cancelamentos e reagendamentos
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Taxas calculadas sobre sessões elegíveis agendadas no período.
          </p>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <MetricPill
          label="Cancelamentos"
          meta={formatPercent(metrics.sessions.cancellationRate)}
          value={formatInteger(metrics.sessions.cancelledCount)}
        />
        <MetricPill
          label="Reagendamentos"
          meta={formatPercent(metrics.sessions.rescheduleRate)}
          value={formatInteger(metrics.sessions.rescheduledCount)}
        />
      </dl>
      <p className="rounded-lg bg-surface-soft p-3 text-sm font-semibold leading-6 text-tesText-secondary">
        Denominador: {formatInteger(metrics.sessions.eligibleScheduledCount)}{" "}
        sessão(ões) confirmadas, concluídas, canceladas, reembolsadas ou com
        ausência registrada.
      </p>
    </AppPageSection>
  );
}

function MetricPill({
  label,
  meta,
  value,
}: {
  label: string;
  meta: string;
  value: string;
}) {
  return (
    <div className="rounded-card border border-brand-lavender bg-white p-4">
      <dt className="text-sm font-bold text-tesText-secondary">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold text-brand-deep">{value}</dd>
      <dd className="mt-1 text-sm font-bold text-brand-primary">{meta}</dd>
    </div>
  );
}

function FinancialEvolutionCard({
  metrics,
}: {
  metrics: TherapistFinancialMetrics;
}) {
  const maxValue = Math.max(
    1,
    ...metrics.financialEvolution.flatMap((point) => [
      point.therapistNetAmountCents,
      point.previousPeriodNetAmountCents ?? 0,
    ]),
  );

  return (
    <AppPageSection className="grid gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-brand-deep">
          Evolução financeira
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Valores líquidos realizados por semana, comparados ao período anterior
          equivalente. Sem estimativa futura nesta fase.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 text-xs font-extrabold text-tesText-secondary">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-brand-primary" /> Realizado
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-brand-lavender" /> Período
          anterior
        </span>
      </div>
      {metrics.financialEvolution.length ? (
        <div className="grid min-h-[190px] grid-cols-[auto_minmax(0,1fr)] gap-3">
          <div className="flex flex-col justify-between py-4 text-xs font-bold text-tesText-muted">
            <span>{formatCurrency(maxValue)}</span>
            <span>{formatCurrency(Math.round(maxValue / 2))}</span>
            <span>R$ 0,00</span>
          </div>
          <div className="flex items-end gap-3 overflow-x-auto rounded-card border border-brand-lavender bg-surface-soft px-4 pb-3 pt-5">
            {metrics.financialEvolution.map((point) => (
              <div
                className="flex min-w-[62px] flex-1 flex-col items-center gap-2"
                key={point.periodStart}
              >
                <div className="flex h-28 items-end gap-1">
                  <span
                    aria-label={`Realizado ${formatCurrency(
                      point.therapistNetAmountCents,
                    )}`}
                    className="w-4 rounded-t bg-brand-primary"
                    style={{
                      height: `${Math.max(
                        4,
                        (point.therapistNetAmountCents / maxValue) * 112,
                      )}px`,
                    }}
                  />
                  <span
                    aria-label={`Período anterior ${formatCurrency(
                      point.previousPeriodNetAmountCents ?? 0,
                    )}`}
                    className="w-4 rounded-t bg-brand-lavender"
                    style={{
                      height: `${Math.max(
                        4,
                        ((point.previousPeriodNetAmountCents ?? 0) / maxValue) *
                          112,
                      )}px`,
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-tesText-secondary">
                  {formatDate(point.periodStart).slice(0, 5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyMetricState message="Sem série financeira para o período selecionado." />
      )}
    </AppPageSection>
  );
}

function RevenueByTherapyCard({
  metrics,
}: {
  metrics: TherapistFinancialMetrics;
}) {
  return (
    <AppPageSection className="grid gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-brand-deep">
          Terapias que mais faturam
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Ordenado por receita líquida. Usa a terapia canônica vinculada ao
          serviço e snapshots financeiros das sessões.
        </p>
      </div>
      {metrics.revenueByTherapy.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-xs font-extrabold uppercase text-tesText-muted">
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Terapia
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Faturamento
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Líquido
                </th>
                <th className="border-b border-brand-lavender py-3 pr-3">
                  Ticket médio
                </th>
                <th className="border-b border-brand-lavender py-3">Sessões</th>
              </tr>
            </thead>
            <tbody>
              {metrics.revenueByTherapy.map((item, index) => (
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
                    {formatCurrency(item.grossAmountCents)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {formatCurrency(item.therapistNetAmountCents)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3 pr-3">
                    {item.averageTicketCents === null
                      ? "Sem base"
                      : formatCurrency(item.averageTicketCents)}
                  </td>
                  <td className="border-b border-brand-lavender/70 py-3">
                    {formatInteger(item.paidSessionCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyMetricState message="Nenhuma terapia teve pagamento confirmado neste período." />
      )}
    </AppPageSection>
  );
}

function EmptyMetricState({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-5">
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
    </div>
  );
}
