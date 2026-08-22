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

import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistPayoutsContract,
} from "../therapist-finance.types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  payoutStatusLabels,
} from "./financial-formatters";
import { buildFinanceHref } from "./financial-route";
import { FinancialStatusBadge } from "./financial-status-badge";

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

  return (
    <div className="grid gap-5">
      <section
        aria-label="Resumo de repasses"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <PayoutMetricCard
          description="Valores elegíveis para entrar no próximo lote."
          icon={Landmark}
          label="Disponível para repasse"
          value={payouts.summary.eligibleForPayoutCents}
        />
        <PayoutMetricCard
          description={
            payouts.summary.nextBatchAt
              ? `Próximo lote previsto para ${formatDateTime(
                  payouts.summary.nextBatchAt,
                  payouts.filters.timezone,
                )}.`
              : "Nenhum lote futuro identificado para este período."
          }
          icon={CalendarClock}
          label="Próximo lote"
          valueText={
            payouts.summary.nextBatchAt
              ? formatDateTime(
                  payouts.summary.nextBatchAt,
                  payouts.filters.timezone,
                )
              : "Sem lote"
          }
        />
        <PayoutMetricCard
          description="Valores já separados em lote ou transferência."
          icon={Clock3}
          label="Em processamento"
          value={payouts.summary.payoutProcessingCents}
        />
        {payouts.summary.blockedCents > 0 ? (
          <PayoutMetricCard
            description="Valores bloqueados por revisão, disputa ou conta."
            icon={ShieldAlert}
            label="Bloqueado"
            value={payouts.summary.blockedCents}
          />
        ) : null}
      </section>

      <AppPageSection className="grid gap-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          method="get"
        >
          <input name="tab" type="hidden" value="repasses" />
          <input name="period" type="hidden" value={dateRange.key} />
          <label className="grid gap-1 text-sm font-extrabold text-brand-deep">
            Status
            <select
              className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              defaultValue={filters.payoutStatus ?? ""}
              name="payoutStatus"
            >
              <option value="">Todos</option>
              {Object.entries(payoutStatusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            type="submit"
          >
            Filtrar
          </button>
          {filters.payoutStatus ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center text-sm font-extrabold text-brand-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={buildFinanceHref({
                period: dateRange.key,
                tab: "payouts",
              })}
            >
              Limpar filtros
            </Link>
          ) : null}
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
            {payouts.pagination.totalCount} lote(s)
          </p>
        </div>

        {payouts.items.length ? (
          <>
            <div className="hidden lg:block">
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
                      Comissão TES
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Reembolso
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Líquido
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Status
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Conciliação
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
                        {item.sessionCount} sessão(ões)
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
                      label="Comissão TES"
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
                      label="Conciliação"
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
              Quando houver valores elegíveis e lote processado, o histórico de
              repasses aparecerá nesta lista.
            </p>
          </div>
        )}

        <PayoutPagination
          dateRange={dateRange}
          filters={filters}
          hasNextPage={payouts.pagination.hasNextPage}
          page={payouts.pagination.page}
        />
      </AppPageSection>

      <AppPageSection className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Como o valor é calculado
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            O cálculo do repasse considera os registros financeiros confirmados.
            Esta tela apresenta apenas a composição autorizada.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <FormulaCard label="Valor bruto" value="Sessões pagas" />
          <FormulaOperator value="-" />
          <FormulaCard label="Comissão TES" value="Comissão da plataforma" />
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
          source_transaction registrado
        </span>
      ) : null}
    </div>
  );
}

function reconciliationLabel(
  status: TherapistPayoutsContract["items"][number]["reconciliationStatus"],
) {
  const labels = {
    failed: "Falha na conciliação",
    matched: "Conciliado",
    needs_reconciliation: "Requer conciliação",
    pending: "Aguardando conciliação",
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
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={buildFinanceHref({
            filters,
            page: page - 1,
            period: dateRange.key,
            tab: "payouts",
          })}
        >
          Anterior
        </Link>
      ) : null}
      {hasNextPage ? (
        <Link
          className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={buildFinanceHref({
            filters,
            page: page + 1,
            period: dateRange.key,
            tab: "payouts",
          })}
        >
          Próxima página
        </Link>
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
