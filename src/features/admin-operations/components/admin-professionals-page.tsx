import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties, ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { buildAdminListHref } from "@/features/admin-shared/admin-list-query";
import { routes } from "@/lib/routes";

import type {
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";
import { formatPlanLabel } from "./admin-operation-display";

type BreakdownItem = {
  colorClass: string;
  label: string;
  value: number;
};

const PLAN_COLORS = [
  "bg-brand-primary",
  "bg-brand-deep",
  "bg-brand-lavender",
  "bg-status-info",
];

const STATUS_COLORS = [
  "bg-status-success",
  "bg-status-warning",
  "bg-status-info",
  "bg-status-danger",
  "bg-brand-primary",
  "bg-tesText-muted",
];

export function AdminProfessionalsPage({
  data,
}: {
  data: AdminOperationPageData;
}) {
  const planBreakdown = buildBreakdown(
    data.rows.map((row) => formatPlanLabel(getField(row, "Plano"))),
    PLAN_COLORS,
  );
  const statusBreakdown = buildBreakdown(
    data.rows.map((row) => translateStatus(row.statusLabel)),
    STATUS_COLORS,
  );

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
            <p className="mt-4 max-w-[780px] text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
              Gerencie profissionais, aprovações, engajamento e desempenho da
              plataforma.
            </p>
          </div>
          <p className="w-fit rounded-[18px] border border-brand-lavender/70 bg-white px-4 py-3 text-sm font-bold text-tesText-secondary shadow-[0_18px_45px_rgba(20,16,90,0.08)]">
            Atualizado em {formatDateTime(data.generatedAt)}
          </p>
        </header>

        <section
          aria-label="Indicadores de profissionais"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        >
          {data.metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <PlanDistributionCard
            items={planBreakdown}
            rowsStatus={data.rowsStatus}
          />
          <UnavailableTrendCard />
          <StatusDistributionCard
            items={statusBreakdown}
            rowsStatus={data.rowsStatus}
          />
        </section>

        <section className="overflow-hidden rounded-[26px] border border-brand-lavender/70 bg-white shadow-[0_24px_70px_rgba(20,16,90,0.11)]">
          <div className="border-b border-brand-lavender/60 px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-brand-deep">
                  Lista de profissionais
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Listagem operacional com dados mínimos e sem conteúdo sensível
                  desnecessário.
                </p>
              </div>
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-brand-lavender bg-brand-lavenderSoft px-5 text-sm font-extrabold text-brand-deep outline-none transition hover:border-brand-primary hover:bg-white focus-visible:ring-4 focus-visible:ring-ring/20 sm:w-fit"
                href={routes.admin.verifications as Route<string>}
              >
                Ver verificações
                <ExternalLink aria-hidden="true" className="size-4" />
              </Link>
            </div>

            <form
              action={data.listHref}
              className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]"
              method="get"
            >
              <label className="relative block">
                <span className="sr-only">Buscar profissionais</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
                />
                <input
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft py-2 pl-11 pr-4 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
                  defaultValue={data.query.search}
                  name="q"
                  placeholder="Buscar por nome, status ou identificador"
                  type="search"
                />
              </label>
              <label>
                <span className="sr-only">Filtrar por status</span>
                <select
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
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
                <span className="sr-only">Ordenar profissionais</span>
                <select
                  className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
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
                  href={data.listHref as Route<string>}
                >
                  Limpar
                </Link>
              </div>
            </form>
          </div>

          <ProfessionalsList data={data} />
          <Pagination data={data} />
        </section>
      </div>
    </main>
  );
}

function MetricCard({ metric }: { metric: AdminOperationMetric }) {
  const Icon = iconForMetric(metric);

  return (
    <article className="min-h-[184px] rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_55px_rgba(20,16,90,0.1)]">
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <span
            className={`grid size-12 place-items-center rounded-[18px] ${metricIconClass(metric)}`}
          >
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <span className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-primary">
            {metric.status === "available" ? "Real" : "Indisp."}
          </span>
        </div>
        <div>
          <p className="text-sm font-extrabold text-tesText-secondary">
            {metric.label}
          </p>
          <p className="mt-2 text-[2.55rem] font-extrabold leading-none text-brand-deep">
            {formatMetricValue(metric)}
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-muted">
            {metric.description}
          </p>
        </div>
      </div>
    </article>
  );
}

function PlanDistributionCard({
  items,
  rowsStatus,
}: {
  items: BreakdownItem[];
  rowsStatus: AdminOperationPageData["rowsStatus"];
}) {
  return (
    <AnalyticsCard
      icon={<Sparkles aria-hidden="true" className="size-5" />}
      subtitle="Planos dos profissionais"
      title="Distribuição por plano"
    >
      {rowsStatus === "available" && items.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-[160px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[160px_minmax(0,1fr)]">
          <div
            aria-hidden="true"
            className="mx-auto grid size-40 place-items-center rounded-full"
            style={donutStyle(items)}
          >
            <div className="grid size-24 place-items-center rounded-full bg-white text-center shadow-inner">
              <span className="text-2xl font-extrabold text-brand-deep">
                {items.reduce((total, item) => total + item.value, 0)}
              </span>
            </div>
          </div>
          <BreakdownLegend items={items} />
        </div>
      ) : (
        <UnavailableState>
          Não há registros disponíveis para calcular a distribuição por plano.
        </UnavailableState>
      )}
    </AnalyticsCard>
  );
}

function UnavailableTrendCard() {
  return (
    <AnalyticsCard
      icon={<TrendingUp aria-hidden="true" className="size-5" />}
      subtitle="Métrica ainda não consolidada"
      title="Crescimento da base"
    >
      <div className="mt-6 rounded-[20px] border border-dashed border-brand-lavender bg-surface-soft p-5">
        <div
          className="flex h-32 items-end gap-2 opacity-70"
          aria-hidden="true"
        >
          {[18, 34, 28, 52, 46, 68, 60].map((height) => (
            <span
              className="flex-1 rounded-t-full bg-brand-lavenderSoft"
              key={height}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <p className="mt-5 text-sm font-bold leading-6 text-tesText-secondary">
          Esta visão ainda não tem histórico consolidado para exibir evolução
          por período.
        </p>
      </div>
    </AnalyticsCard>
  );
}

function StatusDistributionCard({
  items,
  rowsStatus,
}: {
  items: BreakdownItem[];
  rowsStatus: AdminOperationPageData["rowsStatus"];
}) {
  return (
    <AnalyticsCard
      icon={<ShieldCheck aria-hidden="true" className="size-5" />}
      subtitle="Status dos profissionais"
      title="Profissionais por status"
    >
      {rowsStatus === "available" && items.length > 0 ? (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-sm font-extrabold">
                <span className="text-brand-deep">{item.label}</span>
                <span className="text-tesText-secondary">{item.value}</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-brand-lavenderSoft">
                <span
                  className={`block h-full rounded-full ${item.colorClass}`}
                  style={{
                    width: `${Math.max(
                      8,
                      (item.value /
                        Math.max(...items.map((entry) => entry.value))) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <UnavailableState>
          Não há registros disponíveis para calcular a distribuição por status.
        </UnavailableState>
      )}
    </AnalyticsCard>
  );
}

function AnalyticsCard({
  children,
  icon,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <article className="min-h-[306px] rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_55px_rgba(20,16,90,0.09)]">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-brand-lavenderSoft text-brand-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep">{title}</h2>
          <p className="mt-1 text-sm font-bold text-tesText-muted">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </article>
  );
}

function ProfessionalsList({ data }: { data: AdminOperationPageData }) {
  if (data.rowsStatus === "unavailable") {
    return (
      <StateMessage
        message={
          data.rowsUnavailableMessage ??
          "Não foi possível carregar estes profissionais agora."
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
        <table className="min-w-[1080px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-brand-lavender/60 bg-surface-soft">
              {[
                "Nome",
                "Plano",
                "Status",
                "Perfil público",
                "Reservas",
                "Serviços",
                "Atualizado",
                "Ações",
              ].map((heading) => (
                <th
                  className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-tesText-muted"
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
              <ProfessionalsTableRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-brand-lavender/50 xl:hidden">
        {data.rows.map((row) => (
          <ProfessionalMobileCard key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}

function ProfessionalsTableRow({ row }: { row: AdminOperationRow }) {
  const detailHref = row.detailHref as Route<string> | undefined;

  return (
    <tr className="transition hover:bg-surface-soft">
      <td className="px-5 py-5">
        <div className="flex items-center gap-3">
          <AvatarChip name={row.title} />
          <div>
            <p className="text-sm font-extrabold text-brand-deep">
              {row.title}
            </p>
            <p className="mt-1 text-xs font-bold text-tesText-muted">
              {row.subtitle || `ID ${shortId(row.id)}`}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-5">
        <TableBadge>
          {formatPlanLabel(getField(row, "Plano")) || "Não informado"}
        </TableBadge>
      </td>
      <td className="px-5 py-5">
        <StatusPill status={row.statusLabel} />
      </td>
      <td className="px-5 py-5 text-sm font-bold text-tesText-secondary">
        {formatPublicProfileStatus(getField(row, "Perfil público"))}
      </td>
      <td className="px-5 py-5 text-sm font-bold text-tesText-secondary">
        {getField(row, "Reservas") || "Não informado"}
      </td>
      <td className="px-5 py-5 text-sm font-bold text-tesText-secondary">
        {getField(row, "Serviços") || "0"}
      </td>
      <td className="px-5 py-5 text-sm font-bold text-tesText-secondary">
        {getField(row, "Atualizado") || "Não informado"}
      </td>
      <td className="px-5 py-5">
        {detailHref ? (
          <Link
            aria-label={`Ver detalhes de ${row.title}`}
            className="inline-flex size-10 items-center justify-center rounded-full border border-brand-lavender bg-white text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
            href={detailHref}
          >
            <Eye aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

function ProfessionalMobileCard({ row }: { row: AdminOperationRow }) {
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
              {row.subtitle || `ID ${shortId(row.id)}`}
            </p>
          </div>
        </div>
        <StatusPill status={row.statusLabel} />
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {["Plano", "Perfil público", "Reservas", "Serviços", "Atualizado"].map(
          (label) => (
            <div
              className="rounded-[18px] border border-brand-lavender/70 bg-surface-soft p-3"
              key={label}
            >
              <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-tesText-muted">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-extrabold text-brand-deep">
                {formatProfessionalField(row, label)}
              </dd>
            </div>
          ),
        )}
      </dl>

      {detailHref ? (
        <Link
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
          href={detailHref}
        >
          Ver detalhes
          <ExternalLink aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </article>
  );
}

function Pagination({ data }: { data: AdminOperationPageData }) {
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
    <div className="flex flex-col gap-3 border-t border-brand-lavender/60 bg-white px-5 py-4 text-sm font-bold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <p>
        Mostrando {start}-{end} de {data.page.total} profissionais
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

function BreakdownLegend({ items }: { items: BreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          className="flex items-center justify-between gap-3 rounded-[16px] bg-surface-soft px-3 py-2"
          key={item.label}
        >
          <span className="flex items-center gap-2 text-sm font-extrabold text-brand-deep">
            <span className={`size-2.5 rounded-full ${item.colorClass}`} />
            {item.label}
          </span>
          <span className="text-sm font-bold text-tesText-secondary">
            {item.value} ({Math.round((item.value / total) * 100)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function StateMessage({ message }: { message: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center px-5 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-[18px] bg-brand-lavenderSoft text-brand-primary">
          <Clock3 aria-hidden="true" className="size-5" />
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

function TableBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-primary">
      {children}
    </span>
  );
}

function buildBreakdown(values: string[], colors: string[]): BreakdownItem[] {
  const counts = new Map<string, number>();

  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return Array.from(counts.entries())
    .sort(([, left], [, right]) => right - left)
    .map(([label, value], index) => ({
      colorClass: colors[index % colors.length],
      label,
      value,
    }));
}

function donutStyle(items: BreakdownItem[]): CSSProperties {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let accumulated = 0;
  const colorMap: Record<string, string> = {
    "bg-brand-deep": "var(--tes-color-brand-deep)",
    "bg-brand-lavender": "var(--tes-color-brand-lavender)",
    "bg-brand-primary": "var(--tes-color-brand-primary)",
    "bg-status-danger": "var(--tes-color-status-danger)",
    "bg-status-info": "var(--tes-color-status-info)",
    "bg-status-success": "var(--tes-color-status-success)",
    "bg-status-warning": "var(--tes-color-status-warning)",
    "bg-tesText-muted": "var(--tes-color-text-muted)",
  };

  const stops = items
    .map((item) => {
      const start = (accumulated / total) * 100;
      accumulated += item.value;
      const end = (accumulated / total) * 100;
      const color =
        colorMap[item.colorClass] ?? "var(--tes-color-brand-primary)";

      return `${color} ${start}% ${end}%`;
    })
    .join(", ");

  return { background: `conic-gradient(${stops})` };
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

function shortId(id: string) {
  return id ? id.slice(0, 8) : "sem-id";
}

function translateStatus(status?: string) {
  const labels: Record<string, string> = {
    approved: "Aprovado",
    changes_requested: "Ajustes solicitados",
    draft: "Perfil em construção",
    in_review: "Em análise",
    published: "Publicado",
    rejected: "Não aprovado",
    submitted: "Aguardando análise",
    suspended: "Suspenso",
  };

  return status ? (labels[status] ?? "Status não identificado") : "Sem status";
}

function formatProfessionalField(row: AdminOperationRow, label: string) {
  const value = getField(row, label);

  if (label === "Plano") return formatPlanLabel(value) || "Não informado";
  if (label === "Perfil público") return formatPublicProfileStatus(value);

  return value || "Não informado";
}

function formatPublicProfileStatus(status?: string) {
  const labels: Record<string, string> = {
    archived: "Arquivado",
    draft: "Em preparação",
    in_review: "Em análise",
    published: "Publicado",
    unpublished: "Não publicado",
  };

  return status ? (labels[status] ?? "Não informado") : "Não informado";
}

function statusPillClass(status?: string) {
  if (status === "approved" || status === "published") {
    return "bg-status-successBg text-status-success";
  }

  if (status === "submitted" || status === "in_review") {
    return "bg-status-infoBg text-status-info";
  }

  if (status === "changes_requested" || status === "draft") {
    return "bg-status-warningBg text-status-warning";
  }

  if (status === "rejected" || status === "suspended") {
    return "bg-status-dangerBg text-status-danger";
  }

  return "bg-surface-muted text-tesText-secondary";
}

function iconForMetric(metric: AdminOperationMetric) {
  if (metric.key.includes("approved")) return UserCheck;
  if (metric.key.includes("public")) return Eye;
  if (metric.key.includes("booking")) return CalendarDays;
  if (metric.key.includes("professional")) return UsersRound;
  return UserRound;
}

function metricIconClass(metric: AdminOperationMetric) {
  if (metric.status !== "available") {
    return "bg-status-warningBg text-status-warning";
  }

  if (metric.tone === "success") {
    return "bg-status-successBg text-status-success";
  }

  if (metric.tone === "warning") {
    return "bg-status-warningBg text-status-warning";
  }

  if (metric.tone === "danger") {
    return "bg-status-dangerBg text-status-danger";
  }

  return "bg-brand-lavenderSoft text-brand-primary";
}

function paginationLinkClass(disabled: boolean) {
  const base =
    "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20";

  return disabled
    ? `${base} pointer-events-none border-border bg-surface-muted text-tesText-muted`
    : `${base} border-brand-lavender bg-white text-brand-primary hover:bg-brand-lavenderSoft`;
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
  }).format(date);
}
