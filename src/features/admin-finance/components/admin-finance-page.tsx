import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Search,
  ShieldCheck,
} from "lucide-react";

import { buildAdminListHref } from "@/features/admin-shared/admin-list-query";
import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";

import type {
  AdminFinanceMetric,
  AdminFinanceDetailPageData,
  AdminFinancePageData,
  AdminFinanceRow,
} from "../admin-finance.types";
import { AdminPaymentDetailPage } from "./admin-payment-detail-page";

export function AdminFinancePage({ data }: { data: AdminFinancePageData }) {
  return (
    <AppPageContainer className="max-w-[1440px] py-5 lg:py-6">
      <AppPageHeader eyebrow="Admin" title={data.title}>
        {data.description}
      </AppPageHeader>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </section>

      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_380px]">
        <AppPageMain>
          <AppPageSection>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-brand-deep">
                  {data.rowsTitle}
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Fonte: {data.sourceLabel}. Listagem mínima e sem payloads
                  sensíveis.
                </p>
              </div>
              <p className="rounded-md bg-surface-muted px-3 py-2 text-xs font-bold text-tesText-secondary">
                {formatDateTime(data.generatedAt)}
              </p>
            </div>

            <form
              action={data.listHref}
              className="mt-5 grid gap-3 rounded-md border border-border bg-surface-muted p-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]"
              method="get"
            >
              <label className="relative block">
                <span className="sr-only">Buscar registros</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
                />
                <input
                  className="min-h-11 w-full rounded-md border border-border bg-white py-2 pl-10 pr-3 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                  defaultValue={data.query.search}
                  name="q"
                  placeholder="Buscar por nome, status ou identificador"
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
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-extrabold text-white shadow-card outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20 lg:flex-none"
                  type="submit"
                >
                  Filtrar
                </button>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                  href={data.listHref as Route<string>}
                >
                  Limpar
                </Link>
              </div>
            </form>

            <div className="mt-5 overflow-hidden rounded-md border border-border">
              {data.rowsStatus === "unavailable" ? (
                <StateMessage
                  icon="warning"
                  message={
                    data.rowsUnavailableMessage ??
                    "Não foi possível carregar estes registros agora."
                  }
                />
              ) : data.rowsStatus === "forbidden" ? (
                <StateMessage
                  icon="warning"
                  message={
                    data.rowsUnavailableMessage ??
                    "Acesso restrito para este módulo."
                  }
                />
              ) : data.rows.length === 0 ? (
                <StateMessage icon="empty" message={data.emptyMessage} />
              ) : (
                <div className="divide-y divide-border">
                  {data.rows.map((row) => (
                    <FinanceRow key={row.id} row={row} />
                  ))}
                </div>
              )}
            </div>

            <Pagination data={data} />
          </AppPageSection>
        </AppPageMain>

        <AppPageAside>
          <AppPageSection>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-status-successBg text-status-success">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-brand-deep">
                  Guardrails financeiros
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Regras para preservar Stripe, Billing, Connect e ledger como
                  fontes confiáveis.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {data.safetyNotes.map((note) => (
                <p
                  className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold leading-6 text-tesText-secondary"
                  key={note}
                >
                  {note}
                </p>
              ))}
            </div>
          </AppPageSection>
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
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
    <div className="mt-4 flex flex-col gap-3 rounded-md border border-border bg-white p-3 text-sm font-bold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between">
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

function paginationLinkClass(disabled: boolean) {
  const base =
    "inline-flex min-h-10 items-center gap-2 rounded-md border px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20";

  return disabled
    ? `${base} pointer-events-none border-border bg-surface-muted text-tesText-muted`
    : `${base} border-border bg-white text-brand-primary hover:bg-brand-lavenderSoft`;
}

function MetricCard({ metric }: { metric: AdminFinanceMetric }) {
  const Icon = metric.status === "available" ? CheckCircle2 : AlertTriangle;

  return (
    <article className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-brand-deep">
            {metric.label}
          </p>
          <p className="mt-1 text-xs font-bold text-tesText-secondary">
            {metric.source}
          </p>
        </div>
        <Icon aria-hidden="true" className={metricIconClass(metric)} />
      </div>
      <strong className="mt-4 block text-3xl font-extrabold text-brand-deep">
        {formatMetricValue(metric)}
      </strong>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {metric.description}
      </p>
    </article>
  );
}

function formatMetricValue(metric: AdminFinanceMetric) {
  if (metric.status === "available") return metric.value;
  if (metric.status === "forbidden") return "Acesso restrito";

  return "Indisponível";
}

function FinanceRow({ row }: { row: AdminFinanceRow }) {
  return (
    <article className="bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <h3 className="text-base font-extrabold text-brand-deep">
              {row.title}
            </h3>
            {row.statusLabel ? <StatusBadge label={row.statusLabel} /> : null}
          </div>
          {row.subtitle ? (
            <p className="mt-1 break-words text-xs font-bold text-tesText-secondary">
              {row.subtitle}
            </p>
          ) : null}
        </div>

        <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[58%] xl:grid-cols-3">
          {row.fields.map((field) => (
            <div key={`${row.id}-${field.label}`}>
              <dt className="text-xs font-bold text-tesText-secondary">
                {field.label}
              </dt>
              <dd className="mt-1 break-words text-sm font-extrabold text-brand-deep">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {row.detailHref ? (
        <div className="mt-4 flex justify-end">
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
            href={row.detailHref as Route<string>}
          >
            Ver detalhes
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function AdminFinanceDetailPage({
  data,
}: {
  data: AdminFinanceDetailPageData;
}) {
  if (data.module === "payments") {
    return <AdminPaymentDetailPage data={data} />;
  }

  return (
    <AppPageContainer className="max-w-[1440px] py-5 lg:py-6">
      <Link
        className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
        href={data.backHref as Route<string>}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Voltar
      </Link>

      <AppPageHeader eyebrow="Admin" title={data.title}>
        {data.subtitle ?? "Detalhe financeiro seguro."}
      </AppPageHeader>

      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_380px]">
        <AppPageMain>
          <div className="space-y-4">
            {data.sections.map((section) => (
              <AppPageSection key={section.title}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold text-brand-deep">
                      {section.title}
                    </h2>
                    {section.description ? (
                      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                        {section.description}
                      </p>
                    ) : null}
                  </div>
                  {data.statusLabel ? (
                    <StatusBadge label={data.statusLabel} />
                  ) : null}
                </div>
                <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {section.fields.map((field) => (
                    <div
                      className="rounded-md border border-border bg-surface-muted p-3"
                      key={`${section.title}-${field.label}`}
                    >
                      <dt className="text-xs font-bold text-tesText-secondary">
                        {field.label}
                      </dt>
                      <dd className="mt-1 break-words text-sm font-extrabold text-brand-deep">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </AppPageSection>
            ))}
          </div>
        </AppPageMain>

        <AppPageAside>
          <AppPageSection>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-status-successBg text-status-success">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-brand-deep">
                  Segurança financeira
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Fonte segura gerada em {formatDateTime(data.generatedAt)}.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {data.safetyNotes.map((note) => (
                <p
                  className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold leading-6 text-tesText-secondary"
                  key={note}
                >
                  {note}
                </p>
              ))}
            </div>
          </AppPageSection>

          <AppPageSection>
            <h2 className="text-lg font-extrabold text-brand-deep">
              Eventos recentes
            </h2>
            {data.events.length === 0 ? (
              <p className="mt-3 rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold leading-6 text-tesText-secondary">
                Nenhum evento financeiro recente para este registro.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.events.map((event) => (
                  <article
                    className="rounded-md border border-border bg-white p-3"
                    key={event.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-brand-deep">
                          {event.title}
                        </p>
                        <p className="mt-1 text-xs font-bold text-tesText-secondary">
                          {formatDateTime(event.createdAt)} · {event.kind}
                        </p>
                      </div>
                      {event.amountLabel ? (
                        <strong className="text-sm font-extrabold text-brand-deep">
                          {event.amountLabel}
                        </strong>
                      ) : null}
                    </div>
                    {event.subtitle ? (
                      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                        {event.subtitle}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </AppPageSection>
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-7 w-fit items-center rounded-md border border-border bg-surface-muted px-2 py-1 text-xs font-extrabold text-tesText-secondary">
      {label}
    </span>
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
    <div className="grid min-h-36 place-items-center bg-white p-6 text-center">
      <div>
        <Icon
          aria-hidden="true"
          className={
            icon === "warning"
              ? "mx-auto size-8 text-status-warning"
              : "mx-auto size-8 text-tesText-secondary"
          }
        />
        <p className="mt-3 text-sm font-bold leading-6 text-tesText-secondary">
          {message}
        </p>
      </div>
    </div>
  );
}

function metricIconClass(metric: AdminFinanceMetric) {
  if (metric.status !== "available") return "size-5 text-status-warning";
  if (metric.tone === "danger") return "size-5 text-status-danger";
  if (metric.tone === "warning") return "size-5 text-status-warning";
  if (metric.tone === "success") return "size-5 text-status-success";

  return "size-5 text-status-info";
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
