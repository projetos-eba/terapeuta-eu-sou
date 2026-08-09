import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ShieldCheck,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";

import type {
  AdminOperationDetailPageData,
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";
import { AdminOperationCommandPanel } from "./admin-operation-command-panel";

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
        {formatMetricValue(metric)}
      </strong>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {metric.description}
      </p>
    </article>
  );
}

function formatMetricValue(metric: AdminOperationMetric) {
  if (metric.status === "available") return metric.value;
  if (metric.status === "forbidden") return "Acesso restrito";

  return "Indisponível";
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

export function AdminOperationDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
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
        {data.subtitle ?? "Detalhe operacional seguro."}
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
            <AdminOperationCommandPanel data={data} />
          </AppPageSection>

          <AppPageSection>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-status-successBg text-status-success">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-brand-deep">
                  Segurança do detalhe
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
              Auditoria recente
            </h2>
            {data.auditEvents.length === 0 ? (
              <p className="mt-3 rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold leading-6 text-tesText-secondary">
                Nenhum evento administrativo recente para este registro.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.auditEvents.map((event) => (
                  <article
                    className="rounded-md border border-border bg-white p-3"
                    key={event.id}
                  >
                    <p className="text-sm font-extrabold text-brand-deep">
                      {event.action}
                    </p>
                    <p className="mt-1 text-xs font-bold text-tesText-secondary">
                      {formatDateTime(event.createdAt)} · {event.source}
                    </p>
                    {event.permission ? (
                      <p className="mt-2 text-xs font-bold text-tesText-secondary">
                        {event.permission}
                      </p>
                    ) : null}
                    {event.reason ? (
                      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                        {event.reason}
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
