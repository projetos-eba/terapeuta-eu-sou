"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { buildAdminListHref } from "@/features/admin-shared/admin-list-query";
import { routes } from "@/lib/routes";

import type {
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
  AdminPatientAnalytics,
} from "../admin-operations.types";
import {
  AdminPatientActivityAgeChart,
  AdminPatientGrowthChart,
} from "./admin-patient-charts";

type PatientMetricCard = AdminOperationMetric & {
  displayLabel: string;
  icon: "active" | "suspended" | "user" | "users";
};

const unavailableAnalytics: AdminPatientAnalytics = {
  activityAge: [],
  periodDays: 30,
  series: [],
  status: "unavailable",
};

export function AdminPatientsPage({ data }: { data: AdminOperationPageData }) {
  const metrics = buildPatientMetrics(data.metrics);
  const analytics = data.patientAnalytics ?? unavailableAnalytics;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-[1166px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.42em] text-brand-primary">
              Admin
            </p>
            <h1 className="mt-3 font-display text-[3.5rem] font-normal italic leading-[0.95] text-brand-deep sm:text-[4.75rem]">
              {data.title}
            </h1>
            <p className="mt-4 max-w-[840px] text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
              Gerencie os clientes cadastrados e acompanhe a situação de suas
              contas.
            </p>
          </div>
          <p className="w-fit rounded-[18px] border border-brand-lavender/70 bg-white px-4 py-3 text-sm font-bold text-tesText-secondary shadow-[0_18px_45px_rgba(20,16,90,0.08)]">
            Atualizado em {formatDateTime(data.generatedAt)}
          </p>
        </header>

        <section
          aria-label="Indicadores de clientes"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </section>

        <section
          aria-label="Análises da base de clientes"
          className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.9fr)]"
        >
          <ClientEvolutionPanel analytics={analytics} data={data} />
          <LastActivityPanel analytics={analytics} />
        </section>

        <section className="overflow-hidden rounded-[26px] border border-brand-lavender/70 bg-white shadow-[0_24px_70px_rgba(20,16,90,0.11)]">
          <div className="border-b border-brand-lavender/60 px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-brand-deep">
                  Base de clientes
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Listagem operacional com dados mínimos e sem conteúdo clínico.
                </p>
              </div>
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-brand-lavender bg-brand-lavenderSoft px-5 text-sm font-extrabold text-brand-deep outline-none transition hover:border-brand-primary hover:bg-white focus-visible:ring-4 focus-visible:ring-ring/20 sm:w-fit"
                href={routes.admin.support as Route<string>}
              >
                Ver suporte
                <ExternalLink aria-hidden="true" className="size-4" />
              </Link>
            </div>

            <form
              action={data.listHref}
              className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]"
              method="get"
            >
              <input
                name="analyticsPeriod"
                type="hidden"
                value={analytics.periodDays}
              />
              <label className="relative block">
                <span className="sr-only">Buscar clientes</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
                />
                <input
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft py-2 pl-11 pr-4 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
                  defaultValue={data.query.search}
                  name="q"
                  placeholder="Buscar por nome ou ID"
                  type="search"
                />
              </label>
              <label>
                <span className="sr-only">Filtrar por status</span>
                <select
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:bg-white focus:ring-4 focus-visible:ring-ring/20"
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
                <span className="sr-only">Ordenar clientes</span>
                <select
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:bg-white focus:ring-4 focus-visible:ring-ring/20"
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
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand-primary px-6 text-sm font-extrabold text-white shadow-[0_16px_34px_rgba(117,68,183,0.24)] outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20 lg:flex-none"
                  type="submit"
                >
                  Filtrar
                </button>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                  href={
                    withAnalyticsPeriod(
                      data.listHref,
                      analytics.periodDays,
                    ) as Route<string>
                  }
                >
                  Limpar
                </Link>
              </div>
            </form>
          </div>

          <PatientsList data={data} />
          <Pagination analyticsPeriod={analytics.periodDays} data={data} />
        </section>
      </div>
    </main>
  );
}

function MetricCard({ metric }: { metric: PatientMetricCard }) {
  const Icon = iconForMetric(metric.icon);

  return (
    <article className="rounded-[18px] border border-border bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-full ${metricIconClass(metric)}`}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-tesText-secondary">
            {metric.displayLabel}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-3xl font-extrabold leading-tight tabular-nums text-brand-deep">
              {formatMetricValue(metric)}
            </p>
            <MetricChange metric={metric} />
          </div>
          <p className="mt-2 text-sm font-semibold leading-5 text-tesText-secondary">
            {metric.status === "available"
              ? metric.description
              : "Indicador indisponível no momento."}
          </p>
        </div>
      </div>
    </article>
  );
}

function MetricChange({ metric }: { metric: PatientMetricCard }) {
  if (
    metric.status !== "available" ||
    metric.value === null ||
    metric.comparisonValue == null ||
    metric.comparisonValue <= 0
  ) {
    return null;
  }

  const percent =
    ((metric.value - metric.comparisonValue) / metric.comparisonValue) * 100;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
        percent >= 0
          ? "bg-status-successBg text-status-success"
          : "bg-status-dangerBg text-status-danger"
      }`}
    >
      {percent >= 0 ? "+" : "−"}
      {Math.abs(percent).toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
      })}
      %
    </span>
  );
}

function ClientEvolutionPanel({
  analytics,
  data,
}: {
  analytics: AdminPatientAnalytics;
  data: AdminOperationPageData;
}) {
  return (
    <AnalyticsPanel
      icon={<UsersRound aria-hidden="true" className="size-5" />}
      subtitle="Novos cadastros e total acumulado no período."
      title="Evolução de clientes"
      trailing={<AnalyticsPeriodSelect analytics={analytics} data={data} />}
    >
      {analytics.status === "available" && analytics.series.length > 0 ? (
        <>
          <ChartLegend
            items={[
              { colorClass: "bg-brand-primary", label: "Total acumulado" },
              { colorClass: "bg-brand-lavender", label: "Novos cadastros" },
            ]}
          />
          <div className="mt-3 rounded-[18px] bg-gradient-to-b from-surface-soft/80 to-transparent px-1">
            <AdminPatientGrowthChart series={analytics.series} />
          </div>
        </>
      ) : (
        <UnavailableState>
          Não foi possível carregar a evolução da base de clientes agora.
        </UnavailableState>
      )}
    </AnalyticsPanel>
  );
}

function AnalyticsPeriodSelect({
  analytics,
  data,
}: {
  analytics: AdminPatientAnalytics;
  data: AdminOperationPageData;
}) {
  return (
    <form action={data.listHref} method="get">
      <input name="q" type="hidden" value={data.query.search} />
      <input name="status" type="hidden" value={data.query.status} />
      <input name="sort" type="hidden" value={data.query.sort} />
      <input name="pageSize" type="hidden" value={data.query.pageSize} />
      <label>
        <span className="sr-only">Período da evolução de clientes</span>
        <select
          aria-label="Período da evolução de clientes"
          className="min-h-11 rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition focus:border-brand-primary focus:ring-4 focus-visible:ring-ring/20"
          defaultValue={analytics.periodDays}
          name="analyticsPeriod"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </label>
    </form>
  );
}

function LastActivityPanel({
  analytics,
}: {
  analytics: AdminPatientAnalytics;
}) {
  return (
    <AnalyticsPanel
      icon={<Clock3 aria-hidden="true" className="size-5" />}
      subtitle="Distribuição dos clientes pelo tempo sem atividade."
      title="Tempo desde a última atividade"
    >
      {analytics.status === "available" && analytics.activityAge.length > 0 ? (
        <div className="mt-3 rounded-[18px] bg-gradient-to-b from-surface-soft/80 to-transparent px-1">
          <AdminPatientActivityAgeChart activityAge={analytics.activityAge} />
        </div>
      ) : (
        <UnavailableState>
          Não foi possível carregar a distribuição de atividade agora.
        </UnavailableState>
      )}
    </AnalyticsPanel>
  );
}

function AnalyticsPanel({
  children,
  icon,
  subtitle,
  title,
  trailing,
}: {
  children: ReactNode;
  icon: ReactNode;
  subtitle: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <article className="min-h-[356px] rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_55px_rgba(20,16,90,0.09)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-brand-lavenderSoft text-brand-primary">
            {icon}
          </span>
          <div>
            <h2 className="text-xl font-extrabold leading-tight text-brand-deep">
              {title}
            </h2>
            <p className="mt-1 text-sm font-bold leading-6 text-tesText-muted">
              {subtitle}
            </p>
          </div>
        </div>
        {trailing}
      </div>
      {children}
    </article>
  );
}

function ChartLegend({
  items,
}: {
  items: Array<{ colorClass: string; label: string }>;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
      {items.map((item) => (
        <span
          className="inline-flex items-center gap-2 text-sm font-bold text-tesText-secondary"
          key={item.label}
        >
          <span className={`size-2.5 rounded-full ${item.colorClass}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function PatientsList({ data }: { data: AdminOperationPageData }) {
  if (data.rowsStatus === "unavailable") {
    return (
      <StateMessage
        message={
          data.rowsUnavailableMessage ??
          "Não foi possível carregar estes clientes agora."
        }
      />
    );
  }

  if (data.rowsStatus === "forbidden") {
    return (
      <StateMessage
        message={
          data.rowsUnavailableMessage ??
          "Acesso restrito para este módulo administrativo."
        }
      />
    );
  }

  if (data.rows.length === 0) {
    return <StateMessage message={data.emptyMessage} />;
  }

  return (
    <>
      <div className="hidden overflow-x-auto xl:block">
        <table className="min-w-[1120px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-brand-lavender/60 bg-surface-soft">
              {[
                "Nome",
                "ID",
                "Contato",
                "Cadastro",
                "Status",
                "Última atividade",
                "Ações",
              ].map((heading) => (
                <th
                  className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted"
                  key={heading}
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-lavender/50">
            {data.rows.map((row) => (
              <PatientsTableRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-brand-lavender/50 xl:hidden">
        {data.rows.map((row) => (
          <PatientMobileCard key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}

function PatientsTableRow({ row }: { row: AdminOperationRow }) {
  const detailHref = row.detailHref as Route<string> | undefined;

  return (
    <tr className="transition hover:bg-surface-soft">
      <td className="px-5 py-5">
        <div className="flex items-center gap-3">
          <AvatarChip name={row.title} />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-brand-deep">
              {row.title}
            </p>
            <p className="mt-1 text-xs font-bold text-tesText-muted">
              {row.email || "E-mail não informado"}
            </p>
          </div>
        </div>
      </td>
      <td className="max-w-[172px] px-5 py-5 text-xs font-bold text-tesText-secondary">
        <span className="block break-all font-mono" title={getField(row, "ID")}>
          {getField(row, "ID") || "Não informado"}
        </span>
      </td>
      <td className="px-5 py-5 text-sm font-bold text-tesText-secondary">
        {getField(row, "Contato") || "Não informado"}
      </td>
      <td className="px-5 py-5 text-sm font-bold text-tesText-secondary">
        {getField(row, "Cadastro") || "Não informado"}
      </td>
      <td className="px-5 py-5">
        <StatusPill status={getField(row, "Status")} />
      </td>
      <td className="px-5 py-5 text-sm font-bold text-tesText-secondary">
        {getField(row, "Última atividade") || "Sem registro"}
      </td>
      <td className="px-5 py-5">
        {detailHref ? (
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-brand-lavenderSoft px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavender hover:text-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
            href={detailHref}
          >
            Ver cliente
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

function PatientMobileCard({ row }: { row: AdminOperationRow }) {
  const detailHref = row.detailHref as Route<string> | undefined;

  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarChip name={row.title} />
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-brand-deep">
              {row.title}
            </h3>
            <p className="mt-1 truncate text-sm font-bold text-tesText-muted">
              {row.email || "E-mail não informado"}
            </p>
          </div>
        </div>
        <StatusPill status={getField(row, "Status")} />
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {["ID", "Contato", "Cadastro", "Última atividade"].map((label) => (
          <div
            className="rounded-[18px] border border-brand-lavender/70 bg-surface-soft p-3"
            key={label}
          >
            <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-tesText-muted">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-extrabold text-brand-deep">
              {getField(row, label) || "Não informado"}
            </dd>
          </div>
        ))}
      </dl>

      {detailHref ? (
        <Link
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
          href={detailHref}
        >
          Ver cliente
          <ExternalLink aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </article>
  );
}

function Pagination({
  analyticsPeriod,
  data,
}: {
  analyticsPeriod: 30 | 90;
  data: AdminOperationPageData;
}) {
  const start =
    data.page.total === 0 ? 0 : (data.page.page - 1) * data.page.pageSize + 1;
  const end = Math.min(data.page.page * data.page.pageSize, data.page.total);
  const previousHref = withAnalyticsPeriod(
    buildAdminListHref(data.listHref, data.query, {
      page: Math.max(data.page.page - 1, 1),
    }),
    analyticsPeriod,
  );
  const nextHref = withAnalyticsPeriod(
    buildAdminListHref(data.listHref, data.query, {
      page: data.page.page + 1,
    }),
    analyticsPeriod,
  );

  return (
    <div className="flex flex-col gap-3 border-t border-brand-lavender/60 bg-white px-5 py-4 text-sm font-bold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <p>
        Mostrando {start}-{end} de {data.page.total} clientes
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

function AvatarChip({ name }: { name: string }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary">
      {getInitials(name)}
    </span>
  );
}

function StateMessage({ message }: { message: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center px-5 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-[18px] bg-brand-lavenderSoft text-brand-primary">
          <CalendarDays aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-4 text-base font-extrabold text-brand-deep">
          {message}
        </p>
      </div>
    </div>
  );
}

function UnavailableState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-[20px] border border-dashed border-brand-lavender bg-surface-soft p-5 text-sm font-bold leading-6 text-tesText-secondary">
      {children}
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  const label = translateStatus(status);

  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-extrabold uppercase tracking-[0.12em] ${statusPillClass(
        status,
      )}`}
    >
      {label}
    </span>
  );
}

function buildPatientMetrics(
  metrics: AdminOperationMetric[],
): PatientMetricCard[] {
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));

  return [
    toPatientMetric(
      byKey.get("total-patients"),
      "total-patients",
      "Total de clientes",
      "Base cadastrada.",
      "users",
    ),
    toPatientMetric(
      byKey.get("recent-patients"),
      "recent-patients",
      "Novos cadastros",
      recentRegistrationDescription(byKey.get("recent-patients")),
      "user",
    ),
    toPatientMetric(
      byKey.get("active-patients"),
      "active-patients",
      "Contas ativas",
      activeAccountDescription(byKey.get("active-patients")),
      "active",
    ),
    toPatientMetric(
      byKey.get("suspended-patients"),
      "suspended-patients",
      "Clientes suspensos",
      "Novos agendamentos bloqueados.",
      "suspended",
    ),
  ];
}

function toPatientMetric(
  metric: AdminOperationMetric | undefined,
  key: string,
  displayLabel: string,
  description: string,
  icon: PatientMetricCard["icon"],
): PatientMetricCard {
  return {
    comparisonValue: metric?.comparisonValue,
    description,
    displayLabel,
    icon,
    key,
    label: metric?.label ?? displayLabel,
    percentage: metric?.percentage,
    source: metric?.source ?? "patients",
    status: metric?.status ?? "unavailable",
    tone: metric?.tone ?? "info",
    value: metric?.value ?? null,
  };
}

function recentRegistrationDescription(metric?: AdminOperationMetric) {
  const previous = metric?.comparisonValue;
  if (
    metric?.status !== "available" ||
    metric.value === null ||
    previous == null
  ) {
    return "Cadastros dos últimos 30 dias. Comparação indisponível.";
  }
  if (previous === 0) return "Últimos 30 dias · Sem base de comparação.";
  const change = ((metric.value - previous) / previous) * 100;
  const formatted = Math.abs(change).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
  return `Últimos 30 dias · ${change > 0 ? "+" : change < 0 ? "−" : ""}${formatted}% em relação aos 30 dias anteriores.`;
}

function activeAccountDescription(metric?: AdminOperationMetric) {
  return metric?.percentage != null
    ? `${metric.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total de clientes.`
    : "Clientes sem bloqueio de novos agendamentos.";
}

function getField(row: AdminOperationRow, label: string) {
  return row.fields.find((field) => field.label === label)?.value ?? "";
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function translateStatus(status?: string) {
  const labels: Record<string, string> = {
    active: "Ativo",
    anonymized: "Anonimizado",
    deleted: "Excluído",
    suspended: "Suspenso",
  };

  return status ? (labels[status] ?? status) : "Sem status";
}

function statusPillClass(status?: string) {
  if (status === "active") return "bg-status-successBg text-status-success";
  if (status === "deleted" || status === "suspended") {
    return "bg-status-dangerBg text-status-danger";
  }
  if (status === "anonymized") return "bg-status-warningBg text-status-warning";

  return "bg-surface-muted text-tesText-secondary";
}

function iconForMetric(icon: PatientMetricCard["icon"]) {
  if (icon === "active") return ShieldCheck;
  if (icon === "suspended") return ShieldAlert;
  if (icon === "user") return UserRound;
  return UsersRound;
}

function metricIconClass(metric: PatientMetricCard) {
  if (metric.status !== "available") {
    return "bg-status-warningBg text-status-warning";
  }
  if (metric.tone === "success")
    return "bg-status-successBg text-status-success";
  if (metric.tone === "warning")
    return "bg-status-warningBg text-status-warning";
  if (metric.tone === "danger") return "bg-status-dangerBg text-status-danger";

  return "bg-brand-lavenderSoft text-brand-primary";
}

function paginationLinkClass(disabled: boolean) {
  const base =
    "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20";

  return disabled
    ? `${base} pointer-events-none border-border bg-surface-muted text-tesText-muted`
    : `${base} border-brand-lavender bg-white text-brand-primary hover:bg-brand-lavenderSoft`;
}

function withAnalyticsPeriod(href: string, period: 30 | 90) {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("analyticsPeriod", String(period));

  return `${path}?${params.toString()}`;
}

function formatMetricValue(metric: AdminOperationMetric) {
  if (metric.status !== "available" || metric.value === null) return "—";

  return new Intl.NumberFormat("pt-BR").format(metric.value);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
