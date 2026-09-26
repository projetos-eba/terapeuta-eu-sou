import Link from "next/link";
import type { Route } from "next";
import type { ComponentProps } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  CircleX,
  Coins,
  Clock3,
  CreditCard,
  Landmark,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Wallet,
} from "lucide-react";

import type {
  AdminFinanceField,
  AdminFinanceListQuery,
  AdminFinanceMetric,
  AdminFinancePageData,
  AdminFinanceRow,
} from "../admin-finance.types";

const FINANCIAL_KPI_KEYS = [
  "total-payments-amount",
  "gross-platform-commission-amount",
  "stripe-fees-amount",
  "net-platform-revenue-amount",
  "pending-payment-amount",
  "confirmed-payment-amount",
  "failed-payment-amount",
  "pending-refunds-amount",
];

const OPERATIONAL_INDICATOR_KEYS = [
  "therapist-change-refund-reviews",
  "open-disputes",
  "open-payout-batches",
];

const DEFAULT_PERIOD_OPTIONS = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Últimos 90 dias", value: "90d" },
];

export function AdminPaymentsPage({ data }: { data: AdminFinancePageData }) {
  const kpis = data.metrics.filter((metric) =>
    FINANCIAL_KPI_KEYS.includes(metric.key),
  );
  const indicators = data.metrics.filter((metric) =>
    OPERATIONAL_INDICATOR_KEYS.includes(metric.key),
  );
  const periodOptions = data.filterOptions.period ?? DEFAULT_PERIOD_OPTIONS;
  const activePeriod = data.query.period ?? "30d";

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-[1166px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.42em] text-brand-primary">
              Admin
            </p>
            <h1 className="mt-3 font-display text-[3.5rem] font-normal italic leading-[0.95] text-brand-deep sm:text-[4.75rem]">
              Financeiro
            </h1>
            <p className="mt-4 max-w-[820px] text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
              Acompanhe pagamentos, repasses e sinais que precisam de atenção no
              fluxo financeiro da plataforma.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:justify-end">
            <form
              action={data.listHref}
              className="flex items-center gap-2 rounded-[18px] border border-brand-lavender/70 bg-white p-1.5 shadow-[0_18px_45px_rgba(20,16,90,0.08)]"
              method="get"
            >
              <input name="q" type="hidden" value={data.query.search} />
              <input name="status" type="hidden" value={data.query.status} />
              <input name="sort" type="hidden" value={data.query.sort} />
              <input name="pageSize" type="hidden" value={data.query.pageSize} />
              <CalendarDays
                aria-hidden="true"
                className="ml-2 size-4 text-brand-primary"
              />
              <label className="sr-only" htmlFor="finance-top-period">
                Período dos indicadores financeiros
              </label>
              <select
                className="min-h-10 bg-transparent pr-1 text-sm font-extrabold text-brand-deep outline-none"
                defaultValue={activePeriod}
                id="finance-top-period"
                name="period"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                aria-label="Atualizar período"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-primary px-3 text-sm font-extrabold text-white outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
                type="submit"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                Atualizar
              </button>
            </form>
            <p className="w-fit rounded-[18px] border border-brand-lavender/70 bg-white px-4 py-3 text-sm font-bold text-tesText-secondary shadow-[0_18px_45px_rgba(20,16,90,0.08)]">
              Atualizado em {formatDateTime(data.generatedAt)}
            </p>
          </div>
        </header>

        <section
          aria-label="Indicadores financeiros"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        >
          {kpis.map((metric) => (
            <PaymentKpiCard key={metric.key} metric={metric} />
          ))}
        </section>

        <section className="rounded-[26px] border border-brand-lavender/70 bg-white p-5 shadow-[0_24px_70px_rgba(20,16,90,0.09)] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-brand-deep">
                Indicadores operacionais
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                Pontos complementares para acompanhar o fluxo financeiro atual.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {indicators.map((metric) => (
              <PaymentIndicatorCard key={metric.key} metric={metric} />
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-brand-lavender/70 bg-white shadow-[0_24px_70px_rgba(20,16,90,0.11)]">
          <div className="border-b border-brand-lavender/60 px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-brand-deep">
                  Transações e repasses
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Consulte valores, situação atual e repasse em uma visão
                  organizada.
                </p>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-tesText-muted">
                {data.page.total} registro{data.page.total === 1 ? "" : "s"}
              </p>
            </div>

            <form
              action={data.listHref}
              className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto]"
              method="get"
            >
              <label className="relative block">
                <span className="sr-only">Buscar registros financeiros</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
                />
                <input
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft py-2 pl-11 pr-4 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
                  defaultValue={data.query.search}
                  name="q"
                  placeholder="Buscar por profissional, status ou referência"
                  type="search"
                />
              </label>

              <label>
                <span className="sr-only">Filtrar por status</span>
                <select
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                  defaultValue={data.query.status}
                  name="status"
                >
                  {data.filterOptions.status.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="sr-only">Ordenar registros</span>
                <select
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                  defaultValue={data.query.sort || "recent"}
                  name="sort"
                >
                  {data.filterOptions.sort.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="relative block">
                <span className="sr-only">Filtrar por período</span>
                <CalendarDays
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
                />
                <select
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-white py-2 pl-10 pr-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                  defaultValue={activePeriod}
                  name="period"
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                <input
                  name="pageSize"
                  type="hidden"
                  value={data.query.pageSize}
                />
                <button
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
                  type="submit"
                >
                  Aplicar
                </button>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                  href={buildPaymentListHref(data.listHref, data.query, {
                    page: 1,
                    period: "30d",
                    search: "",
                    sort: "",
                    status: "",
                  }) as Route<string>}
                >
                  Limpar
                </Link>
              </div>
            </form>
          </div>

          <div>
            {data.rowsStatus === "forbidden" ? (
              <StateMessage
                icon="warning"
                message="Seu acesso atual não permite consultar este conteúdo."
              />
            ) : data.rowsStatus === "unavailable" ? (
              <StateMessage
                icon="warning"
                message="Não foi possível carregar os registros financeiros agora. Tente novamente em alguns instantes."
              />
            ) : data.rows.length === 0 ? (
              <StateMessage icon="empty" message={data.emptyMessage} />
            ) : (
              <>
                <div className="hidden overflow-x-auto xl:block">
                  <table className="min-w-[1120px] w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-soft text-left text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
                        <th className="px-5 py-4">Data e hora</th>
                        <th className="px-4 py-4">Transação</th>
                        <th className="px-4 py-4">Cliente</th>
                        <th className="px-4 py-4">Profissional</th>
                        <th className="px-4 py-4">Forma de pagamento</th>
                        <th className="px-4 py-4">Valores</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-5 py-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <DesktopPaymentRow key={row.id} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-brand-lavender/60 xl:hidden">
                  {data.rows.map((row) => (
                    <MobilePaymentRow key={row.id} row={row} />
                  ))}
                </div>
              </>
            )}
          </div>

          <Pagination data={data} />
        </section>
      </div>
    </main>
  );
}

function PaymentKpiCard({ metric }: { metric: AdminFinanceMetric }) {
  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_20px_55px_rgba(20,16,90,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <span className={metricIconWrapClass(metric)}>
          <PaymentMetricIcon aria-hidden="true" metric={metric} />
        </span>
        <StatusPill metric={metric} />
      </div>
      <p className="mt-5 text-sm font-extrabold text-tesText-secondary">
        {paymentMetricLabel(metric)}
      </p>
      <strong className="mt-2 block text-[2.2rem] font-extrabold leading-none tracking-tight text-brand-deep">
        {formatMetricValue(metric)}
      </strong>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {paymentMetricDescription(metric)}
      </p>
    </article>
  );
}

function PaymentIndicatorCard({ metric }: { metric: AdminFinanceMetric }) {
  return (
    <article className="rounded-[18px] border border-brand-lavender/60 bg-surface-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={metricIconWrapClass(metric)}>
            <PaymentMetricIcon aria-hidden="true" metric={metric} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-brand-deep">
              {paymentMetricLabel(metric)}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
              Indicador operacional
            </p>
          </div>
        </div>
        <StatusPill metric={metric} compact />
      </div>
      <strong className="mt-4 block text-2xl font-extrabold text-brand-deep">
        {formatMetricValue(metric)}
      </strong>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {paymentMetricDescription(metric)}
      </p>
    </article>
  );
}

function DesktopPaymentRow({ row }: { row: AdminFinanceRow }) {
  const fields = fieldMap(row.fields);

  return (
    <tr className="border-t border-brand-lavender/60 align-top transition hover:bg-surface-soft/70">
      <td className="px-5 py-4">
        <p className="whitespace-nowrap text-sm font-extrabold text-brand-deep">
          {fields["Data e hora"] || "—"}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="max-w-[160px] break-words text-sm font-extrabold text-brand-deep">
          {row.title}
        </p>
        <p className="mt-1 text-xs font-semibold text-tesText-secondary">
          {row.subtitle ?? "Sem referência adicional"}
        </p>
      </td>
      <td className="break-words px-4 py-4 text-sm font-semibold text-brand-deep">
        {fields["Cliente"] || "Não identificado"}
      </td>
      <td className="break-words px-4 py-4 text-sm font-semibold text-brand-deep">
        {fields["Profissional"] || "Não identificado"}
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-brand-deep">
        {fields["Forma de pagamento"] || "Não informado"}
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-extrabold text-brand-deep">
          {fields["Valor bruto"] || "—"}
        </p>
        <p className="mt-1 text-xs font-semibold text-tesText-secondary">
          Comissão TES: {fields["Comissão TES"] || "—"}
        </p>
        <p className="mt-1 text-xs font-semibold text-tesText-muted">
          Repasse: {fields["Repasse terapeuta"] || "—"}
        </p>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col items-start gap-2">
          {row.statusLabel ? <RowStatusBadge label={row.statusLabel} /> : null}
          {fields["Reembolso pendente"] === "Sim" ? (
            <InlineMetaBadge value={fields["Reembolso pendente"]} />
          ) : null}
        </div>
      </td>
      <td className="px-5 py-4 text-right">
        {row.detailHref ? (
          <Link
            aria-label="Ver detalhes do registro financeiro"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
            href={row.detailHref as Route<string>}
          >
            Ver detalhes
          </Link>
        ) : (
          <span className="text-sm font-semibold text-tesText-muted">—</span>
        )}
      </td>
    </tr>
  );
}

function MobilePaymentRow({ row }: { row: AdminFinanceRow }) {
  const fields = fieldMap(row.fields);

  return (
    <article className="p-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-brand-deep">
              {row.title}
            </h3>
            <p className="mt-1 text-xs font-bold text-tesText-secondary">
              {row.subtitle ?? "Sem referência adicional"}
            </p>
          </div>
          {row.statusLabel ? <RowStatusBadge label={row.statusLabel} /> : null}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {row.fields.map((field) => (
            <div key={`${row.id}-${field.label}`}>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
                {field.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-brand-deep">
                {formatOperationalValue(field.value)}
              </dd>
            </div>
          ))}
        </dl>

        {row.detailHref ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
              href={row.detailHref as Route<string>}
            >
              Ver detalhes
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Pagination({ data }: { data: AdminFinancePageData }) {
  const start =
    data.page.total === 0 ? 0 : (data.page.page - 1) * data.page.pageSize + 1;
  const end = Math.min(data.page.page * data.page.pageSize, data.page.total);
  const previousHref = buildPaymentListHref(data.listHref, data.query, {
    page: Math.max(data.page.page - 1, 1),
  });
  const nextHref = buildPaymentListHref(data.listHref, data.query, {
    page: data.page.page + 1,
  });

  return (
    <div className="flex flex-col gap-3 border-t border-brand-lavender/60 px-5 py-4 text-sm font-bold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <p>
        Mostrando {start}-{end} de {data.page.total} registros
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={data.page.page <= 1}
          className={paginationLinkClass(data.page.page <= 1)}
          href={previousHref as Route<string>}
          tabIndex={data.page.page <= 1 ? -1 : undefined}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterior
        </Link>
        <Link
          aria-disabled={!data.page.hasNext}
          className={paginationLinkClass(!data.page.hasNext)}
          href={nextHref as Route<string>}
          tabIndex={!data.page.hasNext ? -1 : undefined}
        >
          Próxima
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function StateMessage({
  icon,
  message,
}: {
  icon: "empty" | "warning";
  message: string;
}) {
  const Icon = icon === "warning" ? AlertTriangle : Clock3;

  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-muted text-brand-primary">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <p className="max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
    </div>
  );
}

function StatusPill({
  compact = false,
  metric,
}: {
  compact?: boolean;
  metric: AdminFinanceMetric;
}) {
  const toneClass =
    metric.status === "forbidden" || metric.status === "unavailable"
      ? "bg-surface-muted text-tesText-secondary"
      : metric.tone === "danger"
        ? "bg-status-dangerBg text-status-danger"
        : metric.tone === "warning"
          ? "bg-status-warningBg text-status-warning"
          : metric.tone === "success"
            ? "bg-status-successBg text-status-success"
            : "bg-brand-lavenderSoft text-brand-primary";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${
        compact ? "" : "uppercase tracking-[0.12em]"
      } ${toneClass}`}
    >
      {metric.status === "available"
        ? metric.tone === "danger"
          ? "Atenção"
          : metric.tone === "warning"
            ? "Em curso"
            : metric.tone === "success"
              ? "Confirmado"
              : "Monitorar"
        : metric.status === "forbidden"
          ? "Restrito"
          : "Indisponível"}
    </span>
  );
}

function RowStatusBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const toneClass =
    normalized.includes("paid") || normalized.includes("partial")
      ? "bg-status-successBg text-status-success"
      : normalized.includes("pending") || normalized.includes("processing")
        ? "bg-status-warningBg text-status-warning"
        : normalized.includes("failed") || normalized.includes("cancel")
          ? "bg-status-dangerBg text-status-danger"
          : "bg-brand-lavenderSoft text-brand-primary";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-[0.12em] ${toneClass}`}
    >
      {formatOperationalValue(label)}
    </span>
  );
}

function InlineMetaBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-tesText-secondary">
      Reembolso pendente: {value}
    </span>
  );
}

function fieldMap(fields: AdminFinanceField[]) {
  return Object.fromEntries(fields.map((field) => [field.label, field.value]));
}

function paymentMetricLabel(metric: AdminFinanceMetric) {
  const labels: Record<string, string> = {
    "confirmed-payment-amount": "Pagamentos confirmados",
    "failed-payment-amount": "Pagamentos com falha",
    "gross-platform-commission-amount": "Comissão bruta TES",
    "net-platform-revenue-amount": "Receita líquida TES",
    "open-disputes": "Contestações abertas",
    "open-payout-batches": "Repasses em andamento",
    "pending-payment-amount": "Pagamentos pendentes",
    "pending-refunds-amount": "Reembolsos pendentes",
    "stripe-fees-amount": "Taxas Stripe",
    "total-payments-amount": "Total de pagamentos",
  };

  return labels[metric.key] ?? metric.label;
}

function paymentMetricDescription(metric: AdminFinanceMetric) {
  const descriptions: Record<string, string> = {
    "confirmed-payment-amount": "Valores com pagamento confirmado.",
    "failed-payment-amount": "Valores que precisam de acompanhamento.",
    "gross-platform-commission-amount": "Parte da plataforma nas cobranças confirmadas.",
    "net-platform-revenue-amount": "Após as taxas de processamento.",
    "open-disputes": "Contestações que ainda aguardam encerramento.",
    "open-payout-batches": "Valores em preparação ou a caminho do banco.",
    "pending-payment-amount": "Valores que aguardam confirmação.",
    "pending-refunds-amount": "Valores que aguardam conclusão.",
    "stripe-fees-amount": "Processamento das cobranças confirmadas.",
    "total-payments-amount": "Valores registrados no período.",
  };

  return descriptions[metric.key] ?? metric.description;
}

function formatOperationalValue(value: string | undefined) {
  if (!value) return "";

  const labels: Record<string, string> = {
    blocked: "Aguardando liberação",
    canceled: "Cancelado",
    cancelled: "Cancelado",
    completed: "Concluído",
    confirmed_by_patient_review: "Confirmado pelo cliente",
    failed: "Falhou",
    not_eligible: "Ainda não elegível",
    paid: "Confirmado",
    partially_refunded: "Reembolso parcial",
    pending: "Pendente",
    processing: "Em processamento",
    refunded: "Reembolsado",
    scheduled: "Agendado",
    succeeded: "Concluído",
  };

  return labels[value.toLowerCase()] ?? value;
}

function formatMetricValue(metric: AdminFinanceMetric) {
  if (metric.status === "available") {
    return FINANCIAL_KPI_KEYS.includes(metric.key)
      ? formatBRLCents(metric.value)
      : metric.value;
  }
  if (metric.status === "forbidden") return "Acesso restrito";

  return "Indisponível";
}

function formatBRLCents(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value / 100);
}

function PaymentMetricIcon({
  metric,
  ...props
}: { metric: AdminFinanceMetric } & ComponentProps<"svg">) {
  const icons = {
    "confirmed-payment-amount": CheckCircle2,
    "failed-payment-amount": CircleX,
    "gross-platform-commission-amount": Coins,
    "net-platform-revenue-amount": CircleDollarSign,
    "open-disputes": ShieldAlert,
    "open-payout-batches": Landmark,
    "pending-payment-amount": Clock3,
    "pending-refunds-amount": RotateCcw,
    "stripe-fees-amount": ReceiptText,
    "therapist-change-refund-reviews": AlertTriangle,
    "total-payments-amount": CreditCard,
  } as const;
  const Icon = icons[metric.key as keyof typeof icons] ?? Wallet;

  return <Icon className="size-5" {...props} />;
}

function buildPaymentListHref(
  baseHref: string,
  current: AdminFinanceListQuery,
  patch: Partial<AdminFinanceListQuery>,
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();

  if (next.search) params.set("q", next.search);
  if (next.status) params.set("status", next.status);
  if (next.sort) params.set("sort", next.sort);
  if (next.period && next.period !== "30d") params.set("period", next.period);
  if (next.page > 1) params.set("page", String(next.page));
  if (next.pageSize !== 12) params.set("pageSize", String(next.pageSize));

  const query = params.toString();
  return query ? `${baseHref}?${query}` : baseHref;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "agora";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function metricIconWrapClass(metric: AdminFinanceMetric) {
  if (metric.status !== "available") {
    return "grid size-11 place-items-center rounded-2xl bg-surface-muted text-tesText-secondary";
  }

  if (metric.tone === "danger") {
    return "grid size-11 place-items-center rounded-2xl bg-status-dangerBg text-status-danger";
  }

  if (metric.tone === "warning") {
    return "grid size-11 place-items-center rounded-2xl bg-status-warningBg text-status-warning";
  }

  if (metric.tone === "success") {
    return "grid size-11 place-items-center rounded-2xl bg-status-successBg text-status-success";
  }

  return "grid size-11 place-items-center rounded-2xl bg-brand-lavenderSoft text-brand-primary";
}

function paginationLinkClass(disabled: boolean) {
  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20";

  return disabled
    ? `${base} pointer-events-none border-brand-lavender/60 bg-surface-soft text-tesText-muted`
    : `${base} border-brand-lavender bg-white text-brand-primary hover:bg-brand-lavenderSoft`;
}
