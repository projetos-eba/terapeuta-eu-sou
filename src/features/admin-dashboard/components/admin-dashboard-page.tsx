import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Info,
  ShieldAlert,
} from "lucide-react";

import type {
  AdminDashboard,
  AdminDashboardAlert,
  AdminDashboardMetric,
  AdminDashboardModule,
} from "../admin-dashboard.types";

type AdminDashboardPageProps = {
  dashboard: AdminDashboard;
};

export function AdminDashboardPage({ dashboard }: AdminDashboardPageProps) {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 py-5 lg:py-6">
      <section className="rounded-lg border border-border bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase text-brand-primary">
              Administração
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight text-brand-deep sm:text-4xl">
              Visão geral
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
              Painel operacional com dados agregados para priorizar catálogo,
              Match, sessões, financeiro e integrações sem expor dados
              desnecessários.
            </p>
          </div>
          <p className="rounded-md bg-surface-muted px-3 py-2 text-xs font-bold text-tesText-secondary">
            Atualizado em {formatDateTime(dashboard.generatedAt)}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {dashboard.summary.map((metric) => (
          <MetricCard key={metric.key} metric={metric} compact />
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="grid gap-4 lg:grid-cols-2">
            {dashboard.modules.map((module) => (
              <ModulePanel key={module.key} module={module} />
            ))}
          </section>
        </div>

        <aside className="space-y-5">
          <AlertPanel alerts={dashboard.alerts} />
          <RecentEventsPanel events={dashboard.events} />
        </aside>
      </div>
    </div>
  );
}

function ModulePanel({ module }: { module: AdminDashboardModule }) {
  const Icon =
    module.status === "ready"
      ? CheckCircle2
      : module.status === "degraded"
        ? AlertTriangle
        : Clock3;

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={moduleIconClass(module.status)}>
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-brand-deep">
              {module.label}
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              {module.description}
            </p>
          </div>
        </div>
        <StatusBadge status={module.status} />
      </div>

      {module.metrics.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {module.metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-surface-muted p-3 text-sm font-bold text-tesText-secondary">
          Contrato dedicado pendente. Módulo exibido sem link para evitar rota
          inexistente.
        </p>
      )}

      {module.href ? (
        <Link
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-extrabold text-white transition hover:bg-brand-deep focus:outline-none focus:ring-4 focus:ring-ring/20"
          href={module.href}
        >
          Abrir módulo
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

function MetricCard({
  compact = false,
  metric,
}: {
  compact?: boolean;
  metric: AdminDashboardMetric;
}) {
  const value = metric.status === "available" ? metric.value : null;

  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-muted p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-extrabold text-brand-deep">
          {metric.label}
        </p>
        <span className={metricToneClass(metric.tone)} />
      </div>
      <strong
        className={
          compact
            ? "mt-2 block text-2xl font-extrabold text-brand-deep"
            : "mt-2 block text-xl font-extrabold text-brand-deep"
        }
      >
        {value === null ? "Indisponível" : value}
      </strong>
      {!compact ? (
        <p className="mt-1 text-xs font-bold leading-5 text-tesText-secondary">
          {metric.description}
        </p>
      ) : null}
    </div>
  );
}

function AlertPanel({ alerts }: { alerts: AdminDashboardAlert[] }) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-status-warningBg text-status-warning">
          <ShieldAlert aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-brand-deep">
            Alertas operacionais
          </h2>
          <p className="text-sm font-semibold text-tesText-secondary">
            Sinais agregados, sem payload sensível.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {alerts.length === 0 ? (
          <p className="rounded-md bg-status-successBg p-3 text-sm font-bold text-status-success">
            Nenhum alerta crítico identificado nas fontes analisadas.
          </p>
        ) : (
          alerts.map((alert) => <AlertItem alert={alert} key={alert.key} />)
        )}
      </div>
    </section>
  );
}

function AlertItem({ alert }: { alert: AdminDashboardAlert }) {
  const content = (
    <>
      <div className="flex items-start gap-3">
        <Info aria-hidden="true" className={alertIconClass(alert.severity)} />
        <span>
          <span className="block text-sm font-extrabold text-brand-deep">
            {alert.label}
          </span>
          <span className="mt-1 block text-sm font-semibold leading-6 text-tesText-secondary">
            {alert.description}
          </span>
        </span>
      </div>
    </>
  );

  if (alert.href) {
    return (
      <Link
        className="block rounded-md border border-border bg-surface-muted p-3 transition hover:border-brand-primary focus:outline-none focus:ring-4 focus:ring-ring/20"
        href={alert.href}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      {content}
    </div>
  );
}

function RecentEventsPanel({
  events,
}: {
  events: Array<{
    actorRole: string;
    createdAt: string;
    entityType: string;
    eventType: string;
    id: string;
    reason: string | null;
  }>;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-card">
      <h2 className="text-base font-extrabold text-brand-deep">
        Auditoria recente
      </h2>
      <p className="mt-1 text-sm font-semibold text-tesText-secondary">
        Últimos eventos administrativos do catálogo.
      </p>

      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <p className="rounded-md bg-surface-muted p-3 text-sm font-bold text-tesText-secondary">
            Ainda sem eventos administrativos recentes acessíveis.
          </p>
        ) : (
          events.map((event) => (
            <div
              className="rounded-md border border-border bg-surface-muted p-3"
              key={event.id}
            >
              <p className="text-sm font-extrabold text-brand-deep">
                {event.eventType}
              </p>
              <p className="mt-1 text-xs font-bold text-tesText-secondary">
                {event.entityType} · {event.actorRole} ·{" "}
                {formatDateTime(event.createdAt)}
              </p>
              {event.reason ? (
                <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                  {event.reason}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: AdminDashboardModule["status"] }) {
  const label = {
    degraded: "Degradado",
    pending: "Pendente",
    ready: "Operacional",
  }[status];

  return (
    <span className="rounded-md border border-border bg-white px-2 py-1 text-xs font-extrabold text-tesText-secondary">
      {label}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function moduleIconClass(status: AdminDashboardModule["status"]) {
  if (status === "ready") {
    return "grid size-10 shrink-0 place-items-center rounded-md bg-status-successBg text-status-success";
  }
  if (status === "degraded") {
    return "grid size-10 shrink-0 place-items-center rounded-md bg-status-warningBg text-status-warning";
  }
  return "grid size-10 shrink-0 place-items-center rounded-md bg-surface-muted text-tesText-secondary";
}

function metricToneClass(tone: AdminDashboardMetric["tone"]) {
  const base = "mt-1 block size-2 shrink-0 rounded-full";

  if (tone === "success") return `${base} bg-status-success`;
  if (tone === "warning") return `${base} bg-status-warning`;
  if (tone === "danger") return `${base} bg-status-danger`;
  if (tone === "info") return `${base} bg-status-info`;

  return `${base} bg-border`;
}

function alertIconClass(severity: AdminDashboardAlert["severity"]) {
  if (severity === "critical")
    return "mt-0.5 size-4 shrink-0 text-status-danger";
  if (severity === "warning")
    return "mt-0.5 size-4 shrink-0 text-status-warning";

  return "mt-0.5 size-4 shrink-0 text-status-info";
}
