import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Wallet,
} from "lucide-react";

import {
  AppPageContainer,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import { buildAdminListHref } from "@/features/admin-shared/admin-list-query";

import type {
  AdminFinanceField,
  AdminFinanceMetric,
  AdminFinancePageData,
  AdminFinanceRow,
} from "../admin-finance.types";

const KPI_COUNT = 4;

export function AdminPaymentsPage({ data }: { data: AdminFinancePageData }) {
  const kpis = data.metrics.slice(0, KPI_COUNT);
  const indicators = data.metrics.slice(KPI_COUNT);

  return (
    <AppPageContainer className="max-w-[1440px] py-5 lg:py-6">
      <AppPageHeader eyebrow="Admin" title="Financeiro">
        Acompanhe os pagamentos recentes, os repasses em aberto e os sinais
        operacionais do financeiro da plataforma.
      </AppPageHeader>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((metric) => (
          <PaymentKpiCard key={metric.key} metric={metric} />
        ))}
      </section>

      <AppPageMain className="mt-6 space-y-6">
        <AppPageSection>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-brand-deep">
                Indicadores operacionais
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                A leitura abaixo destaca pontos que pedem atenção no fluxo
                financeiro atual.
              </p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-tesText-muted">
              Atualizado em {formatDateTime(data.generatedAt)}
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {indicators.map((metric) => (
              <PaymentIndicatorCard key={metric.key} metric={metric} />
            ))}
          </div>
        </AppPageSection>

        <AppPageSection>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-brand-deep">
                Transações e repasses
              </h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                Consulte os registros mais recentes com busca, status e
                ordenação.
              </p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-tesText-muted">
              {data.page.total} registro{data.page.total === 1 ? "" : "s"}
            </p>
          </div>

          <form
            action={data.listHref}
            className="mt-5 grid gap-3 rounded-card border border-brand-lavender/70 bg-surface-muted/70 p-3 lg:grid-cols-[minmax(0,1.4fr)_200px_200px_auto]"
            method="get"
          >
            <label className="relative block">
              <span className="sr-only">Buscar registros financeiros</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
              />
              <input
                className="min-h-11 w-full rounded-md border border-border bg-white py-2 pl-10 pr-3 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                defaultValue={data.query.search}
                name="q"
                placeholder="Buscar por profissional, status ou referência"
                type="search"
              />
            </label>

            <label>
              <span className="sr-only">Filtrar por status</span>
              <select
                className="min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
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
                className="min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
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

            <div className="flex gap-2">
              <input
                name="pageSize"
                type="hidden"
                value={data.query.pageSize}
              />
              <button
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-extrabold text-white shadow-card outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
                type="submit"
              >
                Aplicar
              </button>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                href={data.listHref as Route<string>}
              >
                Limpar
              </Link>
            </div>
          </form>

          <div className="mt-5 rounded-card border border-brand-lavender/70 bg-white shadow-card">
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
                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-bold uppercase tracking-[0.14em] text-tesText-muted">
                        <th className="px-4 py-3">Referência</th>
                        <th className="px-4 py-3">Profissional</th>
                        <th className="px-4 py-3">Atendimento</th>
                        <th className="px-4 py-3">Transferência</th>
                        <th className="px-4 py-3">Valor bruto</th>
                        <th className="px-4 py-3">Repasse</th>
                        <th className="px-4 py-3">Comissão TES</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <DesktopPaymentRow key={row.id} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-border lg:hidden">
                  {data.rows.map((row) => (
                    <MobilePaymentRow key={row.id} row={row} />
                  ))}
                </div>
              </>
            )}
          </div>

          <Pagination data={data} />
        </AppPageSection>
      </AppPageMain>
    </AppPageContainer>
  );
}

function PaymentKpiCard({ metric }: { metric: AdminFinanceMetric }) {
  return (
    <article className="rounded-card border border-brand-lavender/70 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className={metricIconWrapClass(metric)}>
          <Wallet aria-hidden="true" className="size-5" />
        </span>
        <StatusPill metric={metric} />
      </div>
      <p className="mt-5 text-sm font-extrabold text-brand-deep">
        {paymentMetricLabel(metric)}
      </p>
      <strong className="mt-2 block text-3xl font-extrabold tracking-tight text-brand-deep">
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
    <article className="rounded-card border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-brand-deep">
            {paymentMetricLabel(metric)}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
            Indicador operacional
          </p>
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
    <tr className="border-b border-border align-top last:border-b-0">
      <td className="px-4 py-4">
        <div className="min-w-[180px]">
          <p className="text-sm font-extrabold text-brand-deep">{row.title}</p>
          <p className="mt-1 text-xs font-bold text-tesText-secondary">
            {row.subtitle ?? "Sem referência adicional"}
          </p>
          {fields["Atualizado"] ? (
            <p className="mt-2 text-xs font-semibold text-tesText-muted">
              {fields["Atualizado"]}
            </p>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-brand-deep">
        {fields["Profissional"] || "Não identificado"}
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-tesText-secondary">
        {formatOperationalValue(fields["Atendimento"]) || "Não informado"}
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-tesText-secondary">
        {formatOperationalValue(fields["Transferência"]) || "Não informado"}
      </td>
      <td className="px-4 py-4 text-sm font-extrabold text-brand-deep">
        {fields["Valor bruto"] || "—"}
      </td>
      <td className="px-4 py-4 text-sm font-extrabold text-brand-deep">
        {fields["Repasse terapeuta"] || "—"}
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-tesText-secondary">
        {fields["Comissão TES"] || "—"}
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col items-start gap-2">
          {row.statusLabel ? <RowStatusBadge label={row.statusLabel} /> : null}
          {fields["Reembolso pendente"] ? (
            <InlineMetaBadge value={fields["Reembolso pendente"]} />
          ) : null}
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        {row.detailHref ? (
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
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
    <article className="p-4">
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
          <div className="flex justify-end">
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
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
  const previousHref = buildAdminListHref(data.listHref, data.query, {
    page: Math.max(data.page.page - 1, 1),
  });
  const nextHref = buildAdminListHref(data.listHref, data.query, {
    page: data.page.page + 1,
  });

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-card border border-brand-lavender/70 bg-white p-3 text-sm font-bold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between">
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
    "failed-session-payments": "Pagamentos com falha",
    "ledger-entries": "Movimentações registradas",
    "open-disputes": "Contestações abertas",
    "open-payout-batches": "Repasses em andamento",
    "paid-session-payments": "Pagamentos confirmados",
    "pending-refunds": "Reembolsos pendentes",
    "pending-session-payments": "Pagamentos pendentes",
    "stripe-transfers": "Transferências registradas",
  };

  return labels[metric.key] ?? metric.label;
}

function paymentMetricDescription(metric: AdminFinanceMetric) {
  const descriptions: Record<string, string> = {
    "failed-session-payments": "Pagamentos que precisam de acompanhamento.",
    "ledger-entries": "Movimentações preservadas no histórico financeiro.",
    "open-disputes": "Contestações que ainda aguardam encerramento.",
    "open-payout-batches": "Repasses em preparação ou processamento.",
    "paid-session-payments": "Pagamentos confirmados com segurança.",
    "pending-refunds": "Reembolsos que ainda aguardam conclusão.",
    "pending-session-payments": "Pagamentos que aguardam confirmação.",
    "stripe-transfers": "Transferências registradas para acompanhamento.",
  };

  return descriptions[metric.key] ?? metric.description;
}

function formatOperationalValue(value: string | undefined) {
  if (!value) return "";

  const labels: Record<string, string> = {
    canceled: "Cancelado",
    cancelled: "Cancelado",
    completed: "Concluído",
    failed: "Falhou",
    paid: "Confirmado",
    partially_refunded: "Reembolso parcial",
    pending: "Pendente",
    processing: "Em processamento",
    refunded: "Reembolsado",
    succeeded: "Concluído",
  };

  return labels[value.toLowerCase()] ?? value;
}

function formatMetricValue(metric: AdminFinanceMetric) {
  if (metric.status === "available") return metric.value;
  if (metric.status === "forbidden") return "Acesso restrito";

  return "Indisponível";
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
    "inline-flex min-h-10 items-center gap-2 rounded-md border px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20";

  return disabled
    ? `${base} pointer-events-none border-border bg-surface-muted text-tesText-muted`
    : `${base} border-border bg-white text-brand-primary hover:bg-brand-lavenderSoft`;
}
