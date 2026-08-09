import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";

import type {
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";

export function AdminOperationPage({ data }: { data: AdminOperationPageData }) {
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
                  Registros recentes
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Fonte: {data.sourceLabel}. Listagem limitada, sem dados
                  sensíveis desnecessários.
                </p>
              </div>
              <p className="rounded-md bg-surface-muted px-3 py-2 text-xs font-bold text-tesText-secondary">
                {formatDateTime(data.generatedAt)}
              </p>
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-border">
              {data.rowsStatus === "unavailable" ? (
                <StateMessage
                  icon="warning"
                  message={
                    data.rowsUnavailableMessage ??
                    "Não foi possível carregar estes registros agora."
                  }
                />
              ) : data.rows.length === 0 ? (
                <StateMessage icon="empty" message={data.emptyMessage} />
              ) : (
                <div className="divide-y divide-border">
                  {data.rows.map((row) => (
                    <OperationRow key={row.id} row={row} />
                  ))}
                </div>
              )}
            </div>
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
                  Guardrails
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Regras para manter a operação segura até existirem comandos
                  administrativos dedicados.
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

function MetricCard({ metric }: { metric: AdminOperationMetric }) {
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
        {metric.status === "available" ? metric.value : "Indisponível"}
      </strong>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {metric.description}
      </p>
    </article>
  );
}

function OperationRow({ row }: { row: AdminOperationRow }) {
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
            <p className="mt-1 break-all text-xs font-bold text-tesText-secondary">
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
    </article>
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

function metricIconClass(metric: AdminOperationMetric) {
  if (metric.status !== "available") return "size-5 text-status-warning";
  if (metric.tone === "danger") return "size-5 text-status-danger";
  if (metric.tone === "warning") return "size-5 text-status-warning";
  if (metric.tone === "success") return "size-5 text-status-success";

  return "size-5 text-status-info";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
