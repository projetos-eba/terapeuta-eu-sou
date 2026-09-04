import Link from "next/link";
import {
  FileText,
  Hourglass,
  type LucideIcon,
  ReceiptText,
  RotateCcw,
  Search,
} from "lucide-react";

import { AppPageSection } from "@/components/app-page";
import { PendingNavigationLink } from "@/components/tes/pending-navigation-link";
import { routes } from "@/lib/routes";

import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistReceiptStatus,
  TherapistReceiptsContract,
} from "../therapist-finance.types";
import {
  defaultFinancialReceiptCopy,
  financialReceiptCopyByStatus,
  receiptStatusLabels,
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
  formatPaymentOrigin,
} from "./financial-formatters";
import { buildFinanceHref } from "./financial-route";
import { FinancialPeriodFields } from "./financial-period-fields";
import { FinancialStatusBadge } from "./financial-status-badge";

export function FinancialReceiptsTab({
  dateRange,
  filters,
  receipts,
}: {
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  receipts: TherapistReceiptsContract;
}) {
  const receiptCopy = filters.status
    ? financialReceiptCopyByStatus[filters.status]
    : defaultFinancialReceiptCopy;

  return (
    <div className="grid min-w-0 gap-5 [&>*]:min-w-0">
      <AppPageSection className="grid gap-4">
        <form className="grid min-w-0 gap-4" method="get">
          <input name="tab" type="hidden" value="recebimentos" />

          <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:max-w-[720px]">
            <FinancialPeriodFields dateRange={dateRange} />
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,280px)_minmax(180px,240px)_minmax(320px,1fr)]">
            <label className="grid min-w-0 gap-1 text-sm font-extrabold text-brand-deep">
              Situação
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                defaultValue={filters.status ?? ""}
                name="status"
              >
                <option value="">Todos</option>
                {(
                  Object.entries(receiptStatusLabels) as Array<
                    [TherapistReceiptStatus, string]
                  >
                )
                  .filter(([status]) => status !== "waiting_safety_period")
                  .map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-1 text-sm font-extrabold text-brand-deep">
              Terapia
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                defaultValue={filters.therapyId ?? ""}
                name="therapyId"
              >
                <option value="">Todas</option>
                {receipts.therapyOptions.map((option) => (
                  <option key={option.therapyId} value={option.therapyId}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-1 text-sm font-extrabold text-brand-deep sm:col-span-2 lg:col-span-1">
              Buscar paciente
              <span className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary"
                  size={18}
                />
                <input
                  className="min-h-11 w-full rounded-lg border border-brand-lavender bg-white pl-10 pr-3 text-sm font-bold text-brand-deep outline-none placeholder:text-tesText-muted focus-visible:ring-2 focus-visible:ring-brand-primary"
                  defaultValue={filters.search ?? ""}
                  name="q"
                  placeholder="Nome ou terapia"
                  type="search"
                />
              </span>
            </label>
          </div>

          <button
            className="inline-flex min-h-11 w-full items-center justify-center justify-self-start rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
            type="submit"
          >
            Filtrar
          </button>
        </form>

        {hasActiveFilters(filters) ? (
          <Link
            className="inline-flex min-h-11 w-fit items-center justify-center text-sm font-extrabold text-brand-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={buildFinanceHref({
              end: dateRange.end,
              period: dateRange.key,
              start: dateRange.start,
              tab: "receipts",
            })}
          >
            Limpar filtros
          </Link>
        ) : null}
      </AppPageSection>

      <section
        aria-label="Resumo dos recebimentos"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <ReceiptMetricCard
          description="Valor líquido depositado em Payouts pagos e integralmente conciliados."
          icon={ReceiptText}
          label="Recebido no período"
          value={receipts.summary.receivedCents}
        />
        <ReceiptMetricCard
          description="Valores ativos das sessões dentro do período selecionado."
          icon={Hourglass}
          label="Em processamento"
          value={receipts.summary.processingCents}
        />
        {receipts.summary.refundedCents > 0 ? (
          <ReceiptMetricCard
            description="Valores devolvidos ao cliente."
            icon={RotateCcw}
            label="Reembolsos"
            value={receipts.summary.refundedCents}
          />
        ) : null}
        {receipts.summary.disputedCents > 0 ? (
          <ReceiptMetricCard
            description="Pagamentos com disputa registrada."
            icon={FileText}
            label="Disputas"
            value={receipts.summary.disputedCents}
          />
        ) : null}
      </section>

      <ReceiptsVisualSummary receipts={receipts} />

      <AppPageSection className="grid gap-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              {receiptCopy.title}
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              {receiptCopy.description}
            </p>
          </div>
          <p className="text-sm font-bold text-tesText-secondary">
            {receipts.pagination.totalCount} registro(s)
          </p>
        </div>

        {receipts.items.length ? (
          <>
            <div
              aria-label="Lista de recebimentos, seis linhas visíveis"
              className="hidden max-h-[520px] overflow-auto lg:block"
              tabIndex={0}
            >
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-xs font-extrabold uppercase text-tesText-muted">
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Paciente
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Terapia
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Data
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Bruto
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Custos da plataforma
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Líquido
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Método
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Origem do pagamento
                    </th>
                    <th className="border-b border-brand-lavender py-3 pr-3">
                      Situação
                    </th>
                    <th className="border-b border-brand-lavender py-3">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.items.map((item) => (
                    <tr
                      className="text-sm font-bold text-brand-deep"
                      key={item.sessionPaymentId}
                    >
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {item.patientDisplayName}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3 text-tesText-secondary">
                        {item.therapyNameSnapshot}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatDateTime(
                          item.sessionDate,
                          receipts.filters.timezone,
                        )}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatCurrency(item.grossAmountCents)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatCurrency(item.tesCommissionCents)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        {formatCurrency(item.therapistNetAmountCents)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3 text-tesText-secondary">
                        {formatPaymentMethod(item.paymentMethodType)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3 text-tesText-secondary">
                        {formatPaymentOrigin(item.paymentOrigin)}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4 pr-3">
                        <FinancialStatusBadge
                          status={item.receiptStatus}
                          type="receipt"
                        />
                        {item.disputeStatus ? (
                          <p className="mt-1 text-xs font-bold text-status-danger">
                            Disputa: {item.disputeStatus}
                          </p>
                        ) : null}
                      </td>
                      <td className="border-b border-brand-lavender/70 py-4">
                        <ReceiptActions item={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:hidden">
              {receipts.items.map((item) => (
                <article
                  className="rounded-card border border-brand-lavender bg-white p-4"
                  key={item.sessionPaymentId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-brand-deep">
                        {item.patientDisplayName}
                      </h3>
                      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                        {item.therapyNameSnapshot}
                      </p>
                    </div>
                    <FinancialStatusBadge
                      status={item.receiptStatus}
                      type="receipt"
                    />
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ReceiptDetail
                      label="Data"
                      value={formatDateTime(
                        item.sessionDate,
                        receipts.filters.timezone,
                      )}
                    />
                    <ReceiptDetail
                      label="Bruto"
                      value={formatCurrency(item.grossAmountCents)}
                    />
                    <ReceiptDetail
                      label="Custos da plataforma"
                      value={formatCurrency(item.tesCommissionCents)}
                    />
                    <ReceiptDetail
                      label="Líquido"
                      value={formatCurrency(item.therapistNetAmountCents)}
                    />
                    <ReceiptDetail
                      label="Método"
                      value={formatPaymentMethod(item.paymentMethodType)}
                    />
                    <ReceiptDetail
                      label="Origem do pagamento"
                      value={formatPaymentOrigin(item.paymentOrigin)}
                    />
                  </dl>
                  <div className="mt-4">
                    <ReceiptActions item={item} />
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/50 p-6">
            <h3 className="text-lg font-extrabold text-brand-deep">
              {receiptCopy.emptyTitle}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              {receiptCopy.emptyDescription}
            </p>
          </div>
        )}

        <Pagination
          dateRange={dateRange}
          filters={filters}
          hasNextPage={receipts.pagination.hasNextPage}
          page={filters.page}
        />
      </AppPageSection>
    </div>
  );
}

function ReceiptsVisualSummary({
  receipts,
}: {
  receipts: TherapistReceiptsContract;
}) {
  const points = receipts.monthlyTrend;
  const statusTotals = buildStatusTotals(receipts.statusDistribution);
  const total = statusTotals.reduce((sum, item) => sum + item.value, 0);
  const hasStatusData = total > 0;
  const hasData = points.some((point) => point.receivedCents > 0);
  const max = Math.max(1, ...points.map((point) => point.receivedCents));
  const receivedPoints = chartPoints(
    points.map((point) => point.receivedCents),
    max,
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <section className="rounded-card border border-brand-lavender bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Recebimento por mês
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Valores líquidos recebidos no banco, por mês.
            </p>
          </div>
          <span className="rounded-lg bg-brand-lavenderSoft px-3 py-2 text-sm font-extrabold text-brand-primary">
            Mensal
          </span>
        </div>
        <div
          aria-label={
            hasData
              ? "Recebimentos líquidos por mês"
              : "Recebimentos por mês: ainda sem dados"
          }
          className="mt-5 grid min-h-[190px] grid-cols-[auto_minmax(0,1fr)] gap-3"
          role="img"
          tabIndex={0}
        >
          <div className="flex flex-col justify-between py-2 text-xs font-bold text-tesText-muted">
            <span>{formatCurrency(max)}</span>
            <span>{formatCurrency(Math.round(max / 2))}</span>
            <span>R$ 0</span>
          </div>
          <div className="min-w-0 overflow-x-auto rounded-card border border-brand-lavender bg-surface-soft px-4 pb-3 pt-5">
            <svg
              aria-hidden="true"
              className="h-32 min-w-[360px] w-full"
              viewBox="0 0 500 128"
            >
              <path d="M0 112H500" stroke="var(--tes-color-brand-lavender)" />
              {hasData ? (
                <polyline
                  fill="none"
                  points={receivedPoints}
                  stroke="var(--tes-color-status-success)"
                  strokeWidth="4"
                />
              ) : (
                <path
                  d="M0 88 C120 84 180 94 260 82 S410 90 500 78"
                  fill="none"
                  stroke="var(--tes-color-brand-lavender)"
                  strokeDasharray="6 6"
                  strokeWidth="2"
                />
              )}
            </svg>
            <div className="flex min-w-[360px] justify-between gap-3 text-[11px] font-bold text-tesText-muted">
              {points.map((point) => (
                <span key={point.month}>{formatMonth(point.month)}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          {hasData
            ? "Linha verde: valor líquido recebido no banco."
            : "O gráfico será preenchido quando houver movimentação no período."}
        </p>
      </section>

      <section className="rounded-card border border-brand-lavender bg-white p-5">
        <h2 className="text-xl font-extrabold text-brand-deep">
          Distribuição por status
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Situação financeira dos recebimentos consultados.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center">
          <ReceiptDonut
            label={
              hasStatusData
                ? "Distribuição de recebimentos por status"
                : "Distribuição por status: ainda sem dados"
            }
            total={total}
            values={statusTotals}
          />
          <ul className="grid gap-3 text-sm font-bold text-tesText-secondary">
            {(hasStatusData
              ? statusTotals
              : [
                  {
                    label: "Aguardando dados",
                    value: 0,
                    color: "var(--tes-color-brand-lavender)",
                  },
                ]
            ).map((item) => (
              <li
                className="flex items-center justify-between gap-3"
                key={item.label}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: item.color }}
                  />
                  {item.label}
                </span>
                <strong className="shrink-0 text-brand-deep">
                  {hasStatusData ? formatCurrency(item.value) : "-"}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function buildStatusTotals(
  items: TherapistReceiptsContract["statusDistribution"],
) {
  const colors: Record<string, string> = {
    paid: "var(--tes-color-status-success)",
    waiting_settlement: "var(--tes-color-brand-cyan)",
    eligible: "var(--tes-color-brand-primary)",
    blocked: "var(--tes-color-status-warning)",
  };
  return items
    .filter((item) => item.amountCents > 0)
    .map((item) => ({
      color: colors[item.status] ?? "var(--tes-color-brand-lavender)",
      label: receiptStatusLabels[item.status],
      value: item.amountCents,
    }));
}

function chartPoints(values: number[], max: number) {
  if (!values.length) return "";
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 250 : (index / (values.length - 1)) * 500;
      const y = 112 - (value / max) * 96;
      return `${x},${y}`;
    })
    .join(" ");
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  return `${month}/${year.slice(-2)}`;
}

function ReceiptDonut({
  label,
  total,
  values,
}: {
  label: string;
  total: number;
  values: Array<{ color: string; label: string; value: number }>;
}) {
  let offset = 0;
  const stops =
    values.length && total > 0
      ? values
          .map((item) => {
            const start = (offset / total) * 100;
            offset += item.value;
            return `${item.color} ${start}% ${(offset / total) * 100}%`;
          })
          .join(", ")
      : "var(--tes-color-brand-lavender) 0 100%";

  return (
    <div
      aria-label={label}
      className="relative mx-auto grid size-[154px] place-items-center rounded-full"
      role="img"
      style={{ background: `conic-gradient(${stops})` }}
      tabIndex={0}
    >
      <span className="grid size-[104px] place-items-center rounded-full bg-white px-2 text-center text-sm font-extrabold text-brand-deep">
        {total > 0 ? formatCurrency(total) : "-"}
      </span>
    </div>
  );
}

function ReceiptMetricCard({
  description,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={22} />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-brand-deep">{label}</h2>
      <p className="mt-2 text-[24px] font-extrabold leading-tight text-brand-deep">
        {formatCurrency(value)}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {description}
      </p>
    </article>
  );
}

function ReceiptDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-extrabold uppercase text-tesText-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-extrabold text-brand-deep">{value}</dd>
    </div>
  );
}

function ReceiptActions({
  item,
}: {
  item: TherapistReceiptsContract["items"][number];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.sessionDetail(item.bookingId)}
      >
        Detalhes
      </Link>
      {item.receiptUrl ? (
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender px-3 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={item.receiptUrl}
          rel="noreferrer"
          target="_blank"
        >
          Comprovante
        </a>
      ) : null}
    </div>
  );
}

function Pagination({
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
            tab: "receipts",
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
            tab: "receipts",
          })}
        >
          Carregar mais
        </PendingNavigationLink>
      ) : null}
    </div>
  );
}

function hasActiveFilters(filters: TherapistFinanceFilters) {
  return Boolean(filters.search || filters.status || filters.therapyId);
}
