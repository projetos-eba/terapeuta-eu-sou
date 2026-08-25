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
import { routes } from "@/lib/routes";

import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistFinancialOverview,
  TherapistReceiptsContract,
} from "../therapist-finance.types";
import {
  defaultFinancialReceiptCopy,
  financialReceiptCopyByStatus,
  financialStatusLabels,
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
  formatPaymentOrigin,
} from "./financial-formatters";
import { buildFinanceHref } from "./financial-route";
import { FinancialStatusBadge } from "./financial-status-badge";

export function FinancialReceiptsTab({
  dateRange,
  filters,
  overview,
  receipts,
}: {
  dateRange: TherapistFinanceDateRange;
  filters: TherapistFinanceFilters;
  overview: TherapistFinancialOverview;
  receipts: TherapistReceiptsContract;
}) {
  const processingCents = receipts.items
    .filter((item) => item.financialStatus === "processing")
    .reduce((total, item) => total + item.therapistNetAmountCents, 0);
  const refundedCents = receipts.items.reduce(
    (total, item) => total + item.refundedAmountCents,
    0,
  );
  const receiptCopy = filters.status
    ? financialReceiptCopyByStatus[filters.status]
    : defaultFinancialReceiptCopy;

  return (
    <div className="grid gap-5">
      <AppPageSection className="grid gap-4">
        <form
          className="grid gap-3 lg:grid-cols-[150px_180px_1fr_auto]"
          method="get"
        >
          <input name="tab" type="hidden" value="recebimentos" />
          <input name="period" type="hidden" value={dateRange.key} />

          <label className="grid gap-1 text-sm font-extrabold text-brand-deep">
            Situação
            <select
              className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              defaultValue={filters.status ?? ""}
              name="status"
            >
              <option value="">Todos</option>
              {Object.entries(financialStatusLabels).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-extrabold text-brand-deep">
            Terapia
            <select
              className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
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

          <label className="grid gap-1 text-sm font-extrabold text-brand-deep">
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

          <button
            className="inline-flex min-h-11 items-center justify-center self-end rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            type="submit"
          >
            Filtrar
          </button>
        </form>

        {hasActiveFilters(filters) ? (
          <Link
            className="inline-flex min-h-11 w-fit items-center justify-center text-sm font-extrabold text-brand-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={buildFinanceHref({
              period: dateRange.key,
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
          description="Valor bruto pago dentro do período."
          icon={ReceiptText}
          label="Recebido no período"
          value={overview.grossPaidCents}
        />
        <ReceiptMetricCard
          description="Pagamentos ainda em processamento."
          icon={Hourglass}
          label="Em processamento"
          value={processingCents}
        />
        {refundedCents > 0 ? (
          <ReceiptMetricCard
            description="Valores devolvidos ao cliente."
            icon={RotateCcw}
            label="Reembolsos"
            value={refundedCents}
          />
        ) : null}
        {overview.disputedCents > 0 ? (
          <ReceiptMetricCard
            description="Pagamentos com disputa registrada."
            icon={FileText}
            label="Disputas"
            value={overview.disputedCents}
          />
        ) : null}
      </section>

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
            <div className="hidden lg:block">
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
                      Comissão TES
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
                          status={item.financialStatus}
                          type="payment"
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
                      status={item.financialStatus}
                      type="payment"
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
                      label="Comissão TES"
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

        <ReceiptsVisualSummary receipts={receipts} />

        <Pagination
          dateRange={dateRange}
          filters={filters}
          hasNextPage={receipts.pagination.hasNextPage}
          page={receipts.pagination.page}
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
  const points = buildWeeklyPoints(receipts.items);
  const statusTotals = buildStatusTotals(receipts.items);
  const total = statusTotals.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;
  const max = Math.max(1, ...points.map((point) => point.value));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <section className="rounded-card border border-brand-lavender bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Recebimentos por semana
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Valores brutos com pagamento confirmado no período.
            </p>
          </div>
          <span className="rounded-lg bg-brand-lavenderSoft px-3 py-2 text-sm font-extrabold text-brand-primary">
            Semanal
          </span>
        </div>
        <div
          aria-label={
            hasData
              ? "Recebimentos brutos por semana"
              : "Recebimentos por semana: ainda sem dados"
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
          <div className="flex items-end gap-3 overflow-x-auto rounded-card border border-brand-lavender bg-surface-soft px-4 pb-3 pt-5">
            {(points.length
              ? points
              : Array.from({ length: 5 }, (_, index) => ({
                  label: `ref-${index}`,
                  value: 0,
                }))
            ).map((point) => (
              <div
                className="flex min-w-[48px] flex-1 flex-col items-center gap-2"
                key={point.label}
              >
                <span
                  aria-hidden="true"
                  className={`w-7 rounded-t ${hasData ? "bg-brand-primary" : "border border-dashed border-brand-lavender bg-transparent"}`}
                  style={{
                    height: `${Math.max(4, (point.value / max) * 112)}px`,
                  }}
                />
                <span className="text-[11px] font-bold text-tesText-muted">
                  {hasData ? point.label : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          {hasData
            ? "Acompanhe a distribuição dos recebimentos dentro do período selecionado."
            : "O gráfico será preenchido conforme os pagamentos forem confirmados."}
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
              hasData
                ? "Distribuição de recebimentos por status"
                : "Distribuição por status: ainda sem dados"
            }
            total={total}
            values={statusTotals}
          />
          <ul className="grid gap-3 text-sm font-bold text-tesText-secondary">
            {(hasData
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
                  {hasData ? formatCurrency(item.value) : "-"}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function buildWeeklyPoints(items: TherapistReceiptsContract["items"]) {
  const buckets = new Map<string, number>();
  for (const item of items) {
    const date = new Date(item.sessionDate);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = weekStart.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + item.grossAmountCents);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => ({
      label: formatDateTime(`${label}T12:00:00.000Z`).slice(0, 5),
      value,
    }));
}

function buildStatusTotals(items: TherapistReceiptsContract["items"]) {
  const colors: Record<string, string> = {
    paid: "var(--tes-color-status-success)",
    processing: "var(--tes-color-brand-cyan)",
    scheduled: "var(--tes-color-brand-primary)",
  };
  const labels: Record<string, string> = {
    paid: "Pago",
    processing: "Processando",
    scheduled: "Agendado",
  };
  const totals = new Map<string, number>();
  for (const item of items)
    totals.set(
      item.financialStatus,
      (totals.get(item.financialStatus) ?? 0) + item.grossAmountCents,
    );
  return [...totals.entries()].map(([status, value]) => ({
    color: colors[status] ?? "var(--tes-color-brand-lavender)",
    label:
      labels[status] ??
      financialStatusLabels[status as keyof typeof financialStatusLabels] ??
      "Outro",
    value,
  }));
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
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={buildFinanceHref({
            filters,
            page: page - 1,
            period: dateRange.key,
            tab: "receipts",
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
            tab: "receipts",
          })}
        >
          Próxima página
        </Link>
      ) : null}
    </div>
  );
}

function hasActiveFilters(filters: TherapistFinanceFilters) {
  return Boolean(filters.search || filters.status || filters.therapyId);
}
