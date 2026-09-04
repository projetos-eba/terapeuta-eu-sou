import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Landmark,
  type LucideIcon,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import { AppPageSection } from "@/components/app-page";
import { PendingNavigationLink } from "@/components/tes/pending-navigation-link";

import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistPayoutsContract,
} from "../therapist-finance.types";
import {
  formatCurrency,
  formatDate,
  formatDateOnly,
  formatDateTime,
  payoutStatusLabels,
} from "./financial-formatters";
import { buildFinanceHref } from "./financial-route";
import { FinancialPeriodFields } from "./financial-period-fields";
import { FinancialStatusBadge } from "./financial-status-badge";

const payoutHistoryStatuses = [
  "batched",
  "transfer_pending",
  "bank_pending",
  "paid",
  "blocked",
  "failed",
  "reversed",
] as const;

export function FinancialPayoutsTab({
  dateRange,
  filters,
  payouts,
}: {
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  payouts: TherapistPayoutsContract;
}) {
  const hasRefunds = payouts.items.some((item) => item.refundedAmountCents > 0);
  const blockedReasons = payouts.summary.blockedReasonCodes
    .map(
      (reason) =>
        ({
          account: "conta de recebimento",
          other: "análise financeira",
          refund: "reembolso",
          review: "revisão da sessão",
        })[reason],
    )
    .join(", ");

  return (
    <div className="grid min-w-0 gap-5 [&>*]:min-w-0">
      <section
        aria-label="Resumo de repasses"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <PayoutMetricCard
          description="Pagamentos a receber, aguardando confirmação ou em liquidação"
          icon={Clock3}
          label="Em processamento"
          value={payouts.summary.payoutProcessingCents}
        />
        <PayoutMetricCard
          description="Valores prontos para entrar no próximo repasse."
          icon={Landmark}
          label="Disponível para repasse"
          value={payouts.summary.eligibleForPayoutCents}
        />
        <PayoutMetricCard
          description={
            payouts.summary.nextBatchAt
              ? `Próximo lote de transferência previsto para ${formatDateOnly(
                  payouts.summary.nextBatchAt,
                  payouts.filters.timezone,
                )}.`
              : "Sem valores elegíveis para o próximo lote."
          }
          icon={CalendarClock}
          label="Próximo lote de transferência"
          valueText={
            payouts.summary.nextBatchAt
              ? formatDateOnly(
                  payouts.summary.nextBatchAt,
                  payouts.filters.timezone,
                )
              : "Sem previsão"
          }
        />
        {payouts.summary.blockedCents > 0 ? (
          <PayoutMetricCard
            description={
              blockedReasons
                ? `Motivos identificados: ${blockedReasons}.`
                : "Valores em análise ou aguardando regularização."
            }
            icon={ShieldAlert}
            label="Bloqueado"
            value={payouts.summary.blockedCents}
          />
        ) : null}
      </section>

      <PayoutTimeline payouts={payouts} />

      <AppPageSection className="grid gap-4">
        <form className="grid min-w-0 gap-4" method="get">
          <input name="tab" type="hidden" value="repasses" />
          <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:max-w-[720px]">
            <FinancialPeriodFields
              dateRange={dateRange}
              label="Período do histórico"
            />
          </div>
          <div className="grid min-w-0 gap-3 sm:max-w-[360px]">
            <label className="grid gap-1 text-sm font-extrabold text-brand-deep">
              Etapa do repasse
              <select
                className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                defaultValue={filters.payoutStatus ?? ""}
                name="payoutStatus"
              >
                <option value="">Todos</option>
                {payoutHistoryStatuses.map((status) => (
                  <option key={status} value={status}>
                    {payoutStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
              type="submit"
            >
              Filtrar
            </button>
            {filters.payoutStatus ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center text-sm font-extrabold text-brand-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                href={buildFinanceHref({
                  end: dateRange.end,
                  period: dateRange.key,
                  start: dateRange.start,
                  tab: "payouts",
                })}
              >
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </form>
      </AppPageSection>

      <AppPageSection className="grid gap-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Repasses do período
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              A própria lista permite consultar períodos anteriores com filtros.
            </p>
          </div>
          <p className="text-sm font-bold text-tesText-secondary">
            {payouts.pagination.totalCount} repasse(s)
          </p>
        </div>

        {payouts.items.length ? (
          <>
            <div
              aria-label="Histórico de repasses, seis linhas visíveis"
              className="hidden max-h-[520px] overflow-auto lg:block"
              tabIndex={0}
            >
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-xs font-extrabold uppercase text-tesText-muted">
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Período
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Sessões
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Bruto
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Custos da plataforma
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Reembolso
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Líquido
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Situação
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Conferência
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Previsto
                    </th>
                    <th className="border-b border-brand-lavender py-3">
                      Concluído
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.items.map((item) => (
                    <tr
                      className="text-sm font-bold text-brand-deep"
                      key={item.payoutBatchId}
                    >
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatDate(item.periodStart)} -{" "}
                        {formatDate(item.periodEnd)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {item.sessionCount}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatCurrency(item.grossAmountCents)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatCurrency(item.tesCommissionCents)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {item.refundedAmountCents > 0
                          ? formatCurrency(item.refundedAmountCents)
                          : "Sem reembolso"}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatCurrency(item.therapistNetAmountCents)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        <FinancialStatusBadge
                          status={item.transferStatus}
                          type="payout"
                        />
                        {item.blockedReason || item.failedReason ? (
                          <p className="mt-1 text-xs font-bold text-status-danger">
                            {item.blockedReason ?? item.failedReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        <PayoutReconciliation item={item} />
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatDateTime(
                          item.expectedTransferAt,
                          payouts.filters.timezone,
                        )}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4">
                        {formatDateTime(
                          item.transferredAt,
                          payouts.filters.timezone,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:hidden">
              {payouts.items.map((item) => (
                <article
                  className="rounded-card border border-brand-lavender bg-white p-4"
                  key={item.payoutBatchId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-brand-deep">
                        {formatDate(item.periodStart)} -{" "}
                        {formatDate(item.periodEnd)}
                      </h3>
                      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                        {item.sessionCount}{" "}
                        {item.sessionCount === 1 ? "sessão" : "sessões"}
                      </p>
                    </div>
                    <FinancialStatusBadge
                      status={item.transferStatus}
                      type="payout"
                    />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <PayoutDetail
                      label="Bruto"
                      value={formatCurrency(item.grossAmountCents)}
                    />
                    <PayoutDetail
                      label="Custos da plataforma"
                      value={formatCurrency(item.tesCommissionCents)}
                    />
                    <PayoutDetail
                      label="Reembolso"
                      value={
                        item.refundedAmountCents > 0
                          ? formatCurrency(item.refundedAmountCents)
                          : "Sem reembolso"
                      }
                    />
                    <PayoutDetail
                      label="Líquido"
                      value={formatCurrency(item.therapistNetAmountCents)}
                    />
                    <PayoutDetail
                      label="Previsto"
                      value={formatDateTime(
                        item.expectedTransferAt,
                        payouts.filters.timezone,
                      )}
                    />
                    <PayoutDetail
                      label="Concluído"
                      value={formatDateTime(
                        item.transferredAt,
                        payouts.filters.timezone,
                      )}
                    />
                    <PayoutDetail
                      label="Conferência"
                      value={reconciliationLabel(item.reconciliationStatus)}
                    />
                  </dl>
                  <div className="mt-4">
                    <PayoutReconciliation item={item} />
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-6">
            <h3 className="text-lg font-extrabold text-brand-deep">
              Nenhum repasse encontrado
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Quando houver valores prontos e um repasse processado, o histórico
              aparecerá nesta lista.
            </p>
          </div>
        )}

        <PayoutPagination
          dateRange={dateRange}
          filters={filters}
          hasNextPage={payouts.pagination.hasNextPage}
          page={filters.page}
        />
      </AppPageSection>

      <AppPageSection className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Como o valor é calculado
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            O cálculo do repasse considera os pagamentos confirmados. Aqui você
            vê de onde vem cada valor.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <FormulaCard label="Valor bruto" value="Sessões pagas" />
          <FormulaOperator value="-" />
          <FormulaCard
            label="Custos da plataforma"
            value="Custos da plataforma"
          />
          {hasRefunds ? (
            <>
              <FormulaOperator value="-" />
              <FormulaCard
                icon={RotateCcw}
                label="Reembolso ao cliente"
                value="Somente quando existir"
              />
            </>
          ) : null}
          <FormulaOperator value="=" />
          <FormulaCard
            emphasis
            label="Valor líquido"
            value="Repasse do terapeuta"
          />
        </div>
      </AppPageSection>
    </div>
  );
}

function PayoutTimeline({ payouts }: { payouts: TherapistPayoutsContract }) {
  const preparingCents =
    payouts.summary.waitingConfirmationCents +
    payouts.summary.waitingSettlementCents;
  const steps = [
    {
      detail:
        preparingCents > 0 ? formatCurrency(preparingCents) : "Nenhum valor",
      Icon: Clock3,
      label: "Processando",
      tone:
        preparingCents > 0
          ? "bg-status-warning text-white"
          : "bg-brand-lavender text-brand-primary",
    },
    {
      detail:
        payouts.summary.eligibleForPayoutCents > 0
          ? formatCurrency(payouts.summary.eligibleForPayoutCents)
          : "Nenhum valor disponível",
      Icon: CheckCircle2,
      label: "Disponível para o próximo lote",
      tone:
        payouts.summary.eligibleForPayoutCents > 0
          ? "bg-status-success text-white"
          : "bg-brand-lavender text-brand-primary",
    },
    {
      detail: payouts.summary.nextBatchAt
        ? formatDateOnly(payouts.summary.nextBatchAt, payouts.filters.timezone)
        : "Sem valores elegíveis para o próximo lote",
      Icon: CalendarClock,
      label: "Próximo lote de transferência",
      tone: payouts.summary.nextBatchAt
        ? "bg-brand-primary text-white"
        : "bg-brand-lavender text-brand-primary",
    },
  ];

  return (
    <AppPageSection className="grid gap-5 bg-surface-soft/70">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
          Acompanhe o caminho do repasse
        </p>
        <h2 className="mt-2 font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[38px]">
          Próximos repasses
        </h2>
      </div>
      <ol className="grid gap-4 md:grid-cols-3 md:gap-0">
        {steps.map((step, index) => (
          <li
            className="relative grid gap-3 md:px-5 first:md:pl-0 last:md:pr-0"
            key={step.label}
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-6 top-6 hidden h-px w-[calc(100%-1.5rem)] border-t border-dashed border-brand-lavender md:block"
              />
            ) : null}
            <div className="relative z-10 flex items-center gap-3">
              <span
                className={`grid size-12 place-items-center rounded-full ${step.tone}`}
              >
                <step.Icon aria-hidden="true" size={21} />
              </span>
              <span className="text-base font-extrabold text-brand-deep">
                {step.label}
              </span>
            </div>
            <p className="pl-[60px] text-sm font-semibold leading-6 text-tesText-secondary md:pl-0">
              {step.detail}
            </p>
          </li>
        ))}
      </ol>
    </AppPageSection>
  );
}

function PayoutMetricCard({
  description,
  icon: Icon,
  label,
  value,
  valueText,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  value?: number;
  valueText?: string;
}) {
  const resolvedValue = valueText ?? formatCurrency(value ?? 0);

  return (
    <article className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={22} />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-brand-deep">{label}</h2>
      <p className="mt-2 text-[24px] font-extrabold leading-tight text-brand-deep">
        {resolvedValue}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {description}
      </p>
    </article>
  );
}

function PayoutDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-extrabold uppercase text-tesText-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-extrabold text-brand-deep">{value}</dd>
    </div>
  );
}

function PayoutReconciliation({
  item,
}: {
  item: TherapistPayoutsContract["items"][number];
}) {
  const transferReference = item.stripeTransferId
    ? maskStripeReference(item.stripeTransferId)
    : null;

  return (
    <div className="grid gap-1 text-sm font-bold text-brand-deep">
      <span className="inline-flex items-center gap-2">
        <FileCheck2
          aria-hidden="true"
          className="text-brand-primary"
          size={16}
        />
        {reconciliationLabel(item.reconciliationStatus)}
      </span>
      {transferReference ? (
        <span className="text-xs font-bold text-tesText-secondary">
          Transfer {transferReference}
        </span>
      ) : null}
      {item.stripeSourceChargeId ? (
        <span className="text-xs font-bold text-tesText-muted">
          Registro do pagamento confirmado
        </span>
      ) : null}
    </div>
  );
}

function reconciliationLabel(
  status: TherapistPayoutsContract["items"][number]["reconciliationStatus"],
) {
  const labels = {
    failed: "Precisa de conferência",
    matched: "Conferido",
    needs_reconciliation: "Precisa de conferência",
    paid: "Pago e conciliado",
    pending: "Em conferência",
    reversed: "Repasse revertido",
  } satisfies Record<typeof status, string>;

  return labels[status];
}

function maskStripeReference(value: string) {
  if (value.length <= 10) return value;

  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}

function PayoutPagination({
  dateRange,
  filters,
  hasNextPage,
  page,
}: {
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  hasNextPage: boolean;
  page: number;
}) {
  if (page <= 1 && !hasNextPage) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {page > 1 ? (
        <PendingNavigationLink
          className="inline-flex min-h-11 items-center rounded-lg border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={buildFinanceHref({
            end: dateRange.end,
            filters,
            page: page - 1,
            period: dateRange.key,
            start: dateRange.start,
            tab: "payouts",
          })}
        >
          Mostrar menos
        </PendingNavigationLink>
      ) : null}
      {hasNextPage ? (
        <PendingNavigationLink
          className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={buildFinanceHref({
            end: dateRange.end,
            filters,
            page: page + 1,
            period: dateRange.key,
            start: dateRange.start,
            tab: "payouts",
          })}
        >
          Carregar mais
        </PendingNavigationLink>
      ) : null}
    </div>
  );
}

function FormulaCard({
  emphasis = false,
  icon: Icon = CheckCircle2,
  label,
  value,
}: {
  emphasis?: boolean;
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-card border border-brand-lavender bg-white p-4 ${
        emphasis ? "text-brand-primary" : "text-brand-deep"
      }`}
    >
      <Icon aria-hidden="true" size={18} />
      <p className="mt-2 text-base font-extrabold">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
        {value}
      </p>
    </div>
  );
}

function FormulaOperator({ value }: { value: "-" | "=" }) {
  return (
    <div className="hidden items-center justify-center text-xl font-extrabold text-brand-primary md:flex">
      {value}
    </div>
  );
}
