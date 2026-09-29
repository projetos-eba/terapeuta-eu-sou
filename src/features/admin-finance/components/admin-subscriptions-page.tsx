import Link from "next/link";
import type { Route } from "next";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleX,
  CreditCard,
  Crown,
  Download,
  Search,
  UserRound,
} from "lucide-react";

import type {
  AdminFinanceMetric,
  AdminFinancePageData,
  AdminFinanceRow,
} from "../admin-finance.types";
import { AdminFinancePeriodFields } from "./admin-finance-period-fields";

export function AdminSubscriptionsPage({
  data,
}: {
  data: AdminFinancePageData;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-[1280px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.42em] text-brand-primary">
              Admin
            </p>
            <h1 className="mt-3 font-display text-[3.5rem] font-normal italic leading-[0.95] text-brand-deep sm:text-[4.75rem]">
              Assinaturas
            </h1>
            <p className="mt-4 max-w-[780px] text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
              {data.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary shadow-[0_18px_45px_rgba(20,16,90,0.08)] transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
              href={buildFinanceExportHref(data) as Route<string>}
            >
              <Download aria-hidden="true" className="size-4" />
              Baixar relatório
            </Link>
            <p className="w-fit rounded-[18px] border border-brand-lavender/70 bg-white px-4 py-3 text-sm font-bold text-tesText-secondary shadow-[0_18px_45px_rgba(20,16,90,0.08)]">
              Atualizado em {formatDateTime(data.generatedAt)}
            </p>
          </div>
        </header>

        <section
          aria-label="Indicadores de assinaturas"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          {data.metrics.map((metric, index) => (
            <SubscriptionMetricCard
              index={index}
              key={metric.key}
              metric={metric}
            />
          ))}
        </section>

        <section className="overflow-hidden rounded-[26px] border border-brand-lavender/70 bg-white shadow-[0_24px_70px_rgba(20,16,90,0.11)]">
          <div className="border-b border-brand-lavender/60 px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-brand-deep">
                  Assinaturas recentes
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Consulte profissional, plano, ciclo, cobrança e situação
                  atual.
                </p>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-tesText-muted">
                {data.page.total} registro{data.page.total === 1 ? "" : "s"}
              </p>
            </div>

            <SubscriptionFilters data={data} />
          </div>

          <SubscriptionRows data={data} />
          <Pagination data={data} />
        </section>
      </div>
    </main>
  );
}

function SubscriptionFilters({ data }: { data: AdminFinancePageData }) {
  return (
    <form
      action={data.listHref}
      className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6"
      method="get"
    >
      <label className="relative block xl:col-span-2">
        <span className="sr-only">Buscar por profissional</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
        />
        <input
          className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft py-2 pl-11 pr-4 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
          defaultValue={data.query.search}
          name="q"
          placeholder="Buscar por profissional"
          type="search"
        />
      </label>
      <FilterSelect
        label="Plano"
        name="plan"
        options={data.filterOptions.plan ?? []}
        value={data.query.plan ?? ""}
      />
      <FilterSelect
        label="Situação"
        name="status"
        options={data.filterOptions.status}
        value={data.query.status}
      />
      <AdminFinancePeriodFields
        options={data.filterOptions.period ?? []}
        query={data.query}
      />
      <div className="flex gap-2 md:col-span-2 xl:col-span-1">
        <input name="pageSize" type="hidden" value={data.query.pageSize} />
        <button
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
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
  );
}

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        className="min-h-12 w-full rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
        defaultValue={value}
        name={name}
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubscriptionRows({ data }: { data: AdminFinancePageData }) {
  if (data.rowsStatus === "forbidden") {
    return (
      <StateMessage
        text="Seu acesso atual não permite consultar assinaturas."
        title="Acesso restrito"
      />
    );
  }
  if (data.rowsStatus === "unavailable") {
    return (
      <StateMessage
        text="Não foi possível carregar as assinaturas agora. Tente novamente em alguns instantes."
        title="Assinaturas temporariamente indisponíveis"
      />
    );
  }
  if (data.rows.length === 0) {
    return (
      <StateMessage
        text="Nenhuma assinatura corresponde aos filtros selecionados."
        title="Nenhuma assinatura encontrada"
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr className="bg-surface-soft text-left text-xs font-bold uppercase tracking-[0.1em] text-tesText-muted">
              <th className="w-[20%] px-5 py-4">Profissional</th>
              <th className="w-[12%] px-4 py-4">Plano atual</th>
              <th className="w-[14%] px-4 py-4">Situação</th>
              <th className="w-[17%] px-4 py-4">Início / ciclo</th>
              <th className="w-[17%] px-4 py-4">
                Próxima cobrança / renovação
              </th>
              <th className="w-[12%] px-4 py-4">Última cobrança</th>
              <th className="w-[8%] px-5 py-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <DesktopSubscriptionRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-brand-lavender/60 lg:hidden">
        {data.rows.map((row) => (
          <MobileSubscriptionRow key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}

function DesktopSubscriptionRow({ row }: { row: AdminFinanceRow }) {
  const fields = rowFields(row);
  return (
    <tr className="border-t border-brand-lavender/60 align-top transition hover:bg-surface-soft/70">
      <td className="px-5 py-4">
        <p className="break-words text-sm font-extrabold text-brand-deep">
          {fields.Terapeuta || "Não informado"}
        </p>
      </td>
      <td className="px-4 py-4 text-sm font-extrabold text-brand-deep">
        {fields["Plano atual"] || "Não informado"}
      </td>
      <td className="px-4 py-4">
        <StatusBadge label={row.statusLabel} />
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-brand-deep">
        {fields["Início do ciclo"] || "Não informado"}
      </td>
      <td className="px-4 py-4 text-sm font-semibold leading-6 text-brand-deep">
        {fields["Próxima cobrança"] || "Não informado"}
      </td>
      <td className="px-4 py-4 text-sm font-semibold leading-6 text-brand-deep">
        {fields["Última cobrança"] || "Ainda não registrada"}
      </td>
      <td className="px-5 py-4 text-right">
        <DetailLink href={row.detailHref} />
      </td>
    </tr>
  );
}

function MobileSubscriptionRow({ row }: { row: AdminFinanceRow }) {
  const fields = rowFields(row);
  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-brand-deep">
            {fields.Terapeuta || row.title}
          </h3>
          <p className="mt-1 text-sm font-semibold text-tesText-secondary">
            {fields["Plano atual"] || "Plano não informado"}
          </p>
        </div>
        <StatusBadge label={row.statusLabel} />
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {["Início do ciclo", "Próxima cobrança", "Última cobrança"].map(
          (label) => (
            <div key={`${row.id}-${label}`}>
              <dt className="text-xs font-bold uppercase tracking-[0.1em] text-tesText-muted">
                {label}
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold text-brand-deep">
                {fields[label] || "Não informado"}
              </dd>
            </div>
          ),
        )}
      </dl>
      <div className="mt-4 flex justify-end">
        <DetailLink href={row.detailHref} />
      </div>
    </article>
  );
}

function SubscriptionMetricCard({
  index,
  metric,
}: {
  index: number;
  metric: AdminFinanceMetric;
}) {
  const Icon = metricIcon(metric.key);
  const accents = [
    "bg-brand-lavenderSoft text-brand-primary",
    "bg-status-infoBg text-status-info",
    "bg-status-successBg text-status-success",
    "bg-brand-lavenderSoft text-brand-primary",
    "bg-status-dangerBg text-status-danger",
  ];

  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_20px_55px_rgba(20,16,90,0.08)]">
      <span
        className={`grid size-12 place-items-center rounded-[18px] ${accents[index % accents.length]}`}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-5 text-sm font-extrabold text-tesText-secondary">
        {metric.label}
      </p>
      <strong className="mt-2 block text-[2.1rem] font-extrabold leading-none text-brand-deep">
        {metric.status === "available" ? metric.value : "—"}
      </strong>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-muted">
        {metric.description}
      </p>
    </article>
  );
}

function metricIcon(key: string) {
  if (key === "free-therapists") return UserRound;
  if (key === "premium-therapists" || key === "premium-plus-therapists") {
    return Crown;
  }
  if (key === "canceled-subscriptions") return CircleX;
  return CreditCard;
}

function Pagination({ data }: { data: AdminFinancePageData }) {
  const start =
    data.page.total === 0 ? 0 : (data.page.page - 1) * data.page.pageSize + 1;
  const end = Math.min(data.page.page * data.page.pageSize, data.page.total);
  const previousHref = buildSubscriptionHref(
    data,
    Math.max(data.page.page - 1, 1),
  );
  const nextHref = buildSubscriptionHref(data, data.page.page + 1);
  return (
    <div className="flex flex-col gap-3 border-t border-brand-lavender/60 px-5 py-4 text-sm font-bold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <p>
        Mostrando {start}-{end} de {data.page.total} registros
      </p>
      <div className="flex gap-2">
        <Link
          aria-disabled={data.page.page <= 1}
          className={paginationClass(data.page.page <= 1)}
          href={previousHref as Route<string>}
          tabIndex={data.page.page <= 1 ? -1 : undefined}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterior
        </Link>
        <Link
          aria-disabled={!data.page.hasNext}
          className={paginationClass(!data.page.hasNext)}
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

function buildSubscriptionHref(data: AdminFinancePageData, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(data.query.pageSize),
  });
  if (data.query.search) params.set("q", data.query.search);
  if (data.query.plan) params.set("plan", data.query.plan);
  if (data.query.status) params.set("status", data.query.status);
  if (data.query.period) params.set("period", data.query.period);
  if (data.query.period === "custom" && data.query.start && data.query.end) {
    params.set("start", data.query.start);
    params.set("end", data.query.end);
  }
  if (data.query.sort) params.set("sort", data.query.sort);
  return `${data.listHref}?${params.toString()}`;
}

function buildFinanceExportHref(data: AdminFinancePageData) {
  const params = new URLSearchParams({ module: "subscriptions" });

  if (data.query.search) params.set("q", data.query.search);
  if (data.query.plan) params.set("plan", data.query.plan);
  if (data.query.status) params.set("status", data.query.status);
  if (data.query.sort) params.set("sort", data.query.sort);
  if (data.query.period) params.set("period", data.query.period);
  if (data.query.period === "custom" && data.query.start && data.query.end) {
    params.set("start", data.query.start);
    params.set("end", data.query.end);
  }

  return `/api/admin/finance/export?${params.toString()}`;
}

function StateMessage({ text, title }: { text: string; title: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center px-6 py-10 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <CalendarDays aria-hidden="true" className="size-6" />
        </span>
        <h3 className="mt-4 text-xl font-extrabold text-brand-deep">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {text}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ label }: { label?: string }) {
  const normalized = (label ?? "").toLowerCase();
  const tone =
    normalized === "active" || normalized === "trialing"
      ? "bg-status-successBg text-status-success"
      : normalized === "past_due" || normalized === "incomplete"
        ? "bg-status-warningBg text-status-warning"
        : normalized === "unpaid" || normalized === "canceled"
          ? "bg-status-dangerBg text-status-danger"
          : "bg-brand-lavenderSoft text-brand-primary";
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-extrabold ${tone}`}
    >
      {productLabel(label) || "Não informado"}
    </span>
  );
}

function DetailLink({ href }: { href?: string }) {
  if (!href) return <span className="text-sm text-tesText-muted">—</span>;
  return (
    <Link
      aria-label="Ver detalhes da assinatura"
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
      href={href as Route<string>}
    >
      Ver detalhes
      <ChevronRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

function rowFields(row: AdminFinanceRow) {
  return Object.fromEntries(
    row.fields.map((field) => [field.label, field.value]),
  );
}

function productLabel(value?: string) {
  if (!value) return "";
  const labels: Record<string, string> = {
    active: "Ativa",
    canceled: "Cancelada",
    incomplete: "Incompleta",
    incomplete_expired: "Não concluída",
    past_due: "Em atraso",
    paused: "Pausada",
    trialing: "Período de avaliação",
    unpaid: "Inadimplente",
  };
  const normalized = value.trim().toLowerCase();
  return labels[normalized] ?? "Situação não identificada";
}

function paginationClass(disabled: boolean) {
  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20";
  return disabled
    ? `${base} pointer-events-none border-brand-lavender/60 bg-surface-soft text-tesText-muted`
    : `${base} border-brand-lavender bg-white text-brand-primary hover:bg-brand-lavenderSoft`;
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
