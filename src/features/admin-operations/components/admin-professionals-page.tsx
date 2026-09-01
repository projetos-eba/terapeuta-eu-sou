import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { buildAdminListHref } from "@/features/admin-shared/admin-list-query";
import { routes } from "@/lib/routes";

import type {
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";
import { formatPlanLabel, formatStatusLabel } from "./admin-operation-display";

const ATTENTION_STATUSES = new Set([
  "changes_requested",
  "in_review",
  "rejected",
  "submitted",
  "suspended",
]);

export function AdminProfessionalsPage({
  data,
}: {
  data: AdminOperationPageData;
}) {
  const hasActiveFilters = Boolean(
    data.query.search ||
    data.query.status ||
    (data.query.sort && data.query.sort !== "recent"),
  );
  const attentionCount = data.rows.filter((row) =>
    ATTENTION_STATUSES.has(row.statusLabel ?? ""),
  ).length;

  return (
    <div className="min-h-screen bg-background px-1 py-7 sm:px-2 lg:py-9">
      <div className="mx-auto w-full max-w-[1280px] space-y-6">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-brand-primary sm:text-xs">
              Admin
            </p>
            <h1 className="mt-2 font-display text-[2.15rem] font-normal italic leading-none text-brand-deep sm:text-[2.4rem] lg:text-[2.9rem]">
              {data.title}
            </h1>
            <p className="mt-3 max-w-[720px] text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
              Identifique quem precisa de acompanhamento e abra o contexto certo
              para cada decisão administrativa.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
              href={routes.admin.verifications as Route<string>}
            >
              Ver verificações
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <p className="text-[11px] font-bold text-tesText-muted sm:text-xs">
              Atualizado em {formatDateTime(data.generatedAt)}
            </p>
          </div>
        </header>

        <ProfessionalsMetricStrip metrics={data.metrics} />

        <section
          aria-labelledby="professionals-list-title"
          className="overflow-hidden rounded-card border border-border bg-white"
        >
          <div className="px-4 py-5 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2
                  className="text-xl font-extrabold text-brand-deep sm:text-2xl"
                  id="professionals-list-title"
                >
                  Lista de profissionais
                </h2>
                <p className="mt-1 max-w-[700px] text-sm font-semibold leading-6 text-tesText-secondary">
                  Compare situação, disponibilidade e contexto essencial antes
                  de abrir o profissional.
                </p>
              </div>
              {data.rowsStatus === "available" && data.rows.length > 0 ? (
                <PageAttentionSummary
                  attentionCount={attentionCount}
                  visibleCount={data.rows.length}
                />
              ) : null}
            </div>

            <ProfessionalsFilters
              data={data}
              hasActiveFilters={hasActiveFilters}
            />
          </div>

          <div className="border-t border-border">
            <ProfessionalsContent
              data={data}
              hasActiveFilters={hasActiveFilters}
            />
          </div>

          {data.rowsStatus === "available" && data.page.total > 0 ? (
            <ProfessionalsPagination data={data} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ProfessionalsMetricStrip({
  metrics,
}: {
  metrics: AdminOperationMetric[];
}) {
  return (
    <section
      aria-label="Resumo da base de profissionais"
      className="hidden sm:block"
    >
      <dl className="grid grid-cols-2 border-y border-border md:grid-cols-4">
        {metrics.map((metric, index) => (
          <div
            className={`py-4 ${
              index % 2 === 0 ? "pr-4" : "border-l border-border pl-4"
            } ${index >= 2 ? "border-t border-border md:border-t-0" : ""} ${
              index > 0 ? "md:border-l md:border-border md:pl-5" : ""
            } md:px-5 md:first:pl-0 md:last:pr-0`}
            key={metric.key}
          >
            <dt className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-tesText-muted sm:text-xs">
              {metric.label}
            </dt>
            <dd className="mt-2 text-2xl font-extrabold tabular-nums text-brand-deep sm:text-[1.75rem]">
              {formatMetricValue(metric)}
            </dd>
            <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
              {metric.status === "available"
                ? metric.description
                : "Informação indisponível agora."}
            </p>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PageAttentionSummary({
  attentionCount,
  visibleCount,
}: {
  attentionCount: number;
  visibleCount: number;
}) {
  return (
    <p
      aria-live="polite"
      className="max-w-sm text-sm font-semibold leading-5 text-tesText-secondary lg:text-right"
    >
      <span className="block">
        <strong className="text-brand-deep">{visibleCount}</strong>{" "}
        {visibleCount === 1
          ? "profissional nesta página"
          : "profissionais nesta página"}
        .
      </span>
      <span className="block">
        {attentionCount > 0
          ? `${attentionCount} ${attentionCount === 1 ? "perfil pede" : "perfis pedem"} acompanhamento.`
          : "Nenhum está em estado de acompanhamento."}
      </span>
    </p>
  );
}

function ProfessionalsFilters({
  data,
  hasActiveFilters,
}: {
  data: AdminOperationPageData;
  hasActiveFilters: boolean;
}) {
  const activeFilterCount = [
    Boolean(data.query.search),
    Boolean(data.query.status),
    Boolean(data.query.sort && data.query.sort !== "recent"),
  ].filter(Boolean).length;

  return (
    <>
      <form
        action={data.listHref}
        className="mt-5 hidden gap-3 md:grid md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-end"
        method="get"
        role="search"
      >
        <ProfessionalSearchField
          defaultValue={data.query.search}
          label="Buscar profissionais"
        />
        <ProfessionalStatusFilter data={data} />
        <ProfessionalSortFilter data={data} />
        <FilterActions data={data} hasActiveFilters={hasActiveFilters} />
      </form>

      <form
        action={data.listHref}
        className="mt-5 grid gap-3 md:hidden"
        method="get"
        role="search"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_48px] gap-2">
          <ProfessionalSearchField
            defaultValue={data.query.search}
            label="Buscar"
          />
          <button
            aria-label="Buscar profissionais"
            className="mt-[30px] inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary text-white outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" />
          </button>
        </div>

        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md border border-border bg-surface-soft px-3 text-sm font-extrabold text-brand-deep outline-none transition hover:border-brand-lavender focus-visible:ring-4 focus-visible:ring-ring/20">
            <span className="flex items-center gap-2">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Mais filtros
              {activeFilterCount > 0 ? (
                <span className="text-brand-primary">
                  ({activeFilterCount} ativos)
                </span>
              ) : null}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition group-open:rotate-180"
            />
          </summary>
          <div className="mt-3 grid gap-3">
            <ProfessionalStatusFilter data={data} />
            <ProfessionalSortFilter data={data} />
            <FilterActions data={data} hasActiveFilters={hasActiveFilters} />
          </div>
        </details>
      </form>
    </>
  );
}

function ProfessionalSearchField({
  defaultValue,
  label,
}: {
  defaultValue: string;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        {label}
      </span>
      <span className="relative block">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tesText-muted"
        />
        <input
          className="min-h-11 w-full rounded-md border border-border bg-white py-2 pl-10 pr-3 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
          defaultValue={defaultValue}
          name="q"
          placeholder="Nome, status ou identificador"
          type="search"
        />
      </span>
    </label>
  );
}

function ProfessionalStatusFilter({ data }: { data: AdminOperationPageData }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        Situação
      </span>
      <select
        className="min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm font-semibold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
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
  );
}

function ProfessionalSortFilter({ data }: { data: AdminOperationPageData }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        Ordenar por
      </span>
      <select
        className="min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm font-semibold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus-visible:ring-ring/20"
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
  );
}

function FilterActions({
  data,
  hasActiveFilters,
}: {
  data: AdminOperationPageData;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="flex items-end gap-2">
      <input name="pageSize" type="hidden" value={data.query.pageSize} />
      <button
        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-extrabold text-white outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20 md:flex-none"
        type="submit"
      >
        Aplicar
      </button>
      {hasActiveFilters ? (
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
          href={data.listHref as Route<string>}
        >
          Limpar
        </Link>
      ) : null}
    </div>
  );
}

function ProfessionalsContent({
  data,
  hasActiveFilters,
}: {
  data: AdminOperationPageData;
  hasActiveFilters: boolean;
}) {
  if (data.rowsStatus === "unavailable") {
    return (
      <ProfessionalsState
        message="Não foi possível carregar os profissionais agora. Tente novamente em alguns instantes."
        title="Profissionais indisponíveis"
        tone="warning"
      />
    );
  }

  if (data.rowsStatus === "forbidden") {
    return (
      <ProfessionalsState
        message="Seu acesso atual não permite consultar esta lista."
        title="Acesso restrito"
        tone="warning"
      />
    );
  }

  if (data.rows.length === 0) {
    return (
      <ProfessionalsState
        action={
          hasActiveFilters
            ? { href: data.listHref, label: "Limpar filtros" }
            : undefined
        }
        message={
          hasActiveFilters
            ? "Não encontramos profissionais com os critérios selecionados."
            : data.emptyMessage
        }
        title={
          hasActiveFilters
            ? "Nenhum resultado para estes filtros"
            : "Nenhum profissional disponível"
        }
      />
    );
  }

  return (
    <>
      <ProfessionalsTable rows={data.rows} />
      <ProfessionalsEntityList rows={data.rows} />
    </>
  );
}

function ProfessionalsTable({ rows }: { rows: AdminOperationRow[] }) {
  return (
    <div className="hidden xl:block">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">
          Profissionais com situação, disponibilidade, contexto e ação de
          detalhe
        </caption>
        <colgroup>
          <col className="w-[27%]" />
          <col className="w-[21%]" />
          <col className="w-[20%]" />
          <col className="w-[18%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-surface-soft/70">
            {[
              "Profissional",
              "Situação",
              "Disponibilidade",
              "Contexto",
              "Ação",
            ].map((heading) => (
              <th
                className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-tesText-muted"
                key={heading}
                scope="col"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <ProfessionalTableRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfessionalTableRow({ row }: { row: AdminOperationRow }) {
  const detailHref = row.detailHref as Route<string> | undefined;

  return (
    <tr className="transition hover:bg-surface-soft/70">
      <td className="px-5 py-4 align-top">
        <ProfessionalIdentity row={row} />
      </td>
      <td className="px-5 py-4 align-top">
        <ProfessionalStatus status={row.statusLabel} />
      </td>
      <td className="px-5 py-4 align-top">
        <CompactPair
          label="Perfil"
          value={formatPublicProfileStatus(getField(row, "Perfil público"))}
        />
        <CompactPair
          className="mt-2"
          label="Reservas"
          value={getField(row, "Reservas") || "Não informado"}
        />
        <CompactPair
          className="mt-2"
          label="Publicação"
          value={getField(row, "Publicação") || "Não informado"}
        />
        {getField(row, "Pendências de publicação") ? (
          <p className="mt-2 text-xs font-semibold leading-5 text-status-warning">
            {getField(row, "Pendências de publicação")}
          </p>
        ) : null}
      </td>
      <td className="px-5 py-4 align-top">
        <p className="text-sm font-extrabold text-brand-deep">
          {formatPlanLabel(getField(row, "Plano")) || "Plano não informado"}
        </p>
        <p className="mt-2 text-[11px] font-semibold leading-4 text-tesText-muted sm:text-xs">
          Atualizado em {getField(row, "Atualizado") || "data não informada"}
        </p>
      </td>
      <td className="px-5 py-4 align-top">
        {detailHref ? (
          <Link
            aria-label={`Ver profissional ${row.title}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
            href={detailHref}
          >
            Ver profissional
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

function ProfessionalsEntityList({ rows }: { rows: AdminOperationRow[] }) {
  return (
    <div className="divide-y divide-border xl:hidden">
      {rows.map((row) => (
        <ProfessionalEntity key={row.id} row={row} />
      ))}
    </div>
  );
}

function ProfessionalEntity({ row }: { row: AdminOperationRow }) {
  const detailHref = row.detailHref as Route<string> | undefined;

  return (
    <article className="px-4 py-5 sm:px-5 lg:px-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.7fr)] sm:items-start">
        <ProfessionalIdentity row={row} />
        <ProfessionalStatus status={row.statusLabel} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
        <EntityField
          label="Perfil público"
          value={formatPublicProfileStatus(getField(row, "Perfil público"))}
        />
        <EntityField
          label="Reservas"
          value={getField(row, "Reservas") || "Não informado"}
        />
        <EntityField
          label="Publicação"
          value={getField(row, "Publicação") || "Não informado"}
        />
        <EntityField
          label="Plano"
          value={formatPlanLabel(getField(row, "Plano")) || "Não informado"}
        />
        <EntityField
          label="Atualizado"
          value={getField(row, "Atualizado") || "Não informado"}
        />
      </dl>

      {detailHref ? (
        <div className="mt-5 flex justify-end">
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20 sm:w-auto"
            href={detailHref}
          >
            Ver profissional
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      ) : null}
    </article>
  );
}

function ProfessionalIdentity({ row }: { row: AdminOperationRow }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary">
        {getInitials(row.title)}
      </span>
      <div className="min-w-0">
        <p className="break-words text-sm font-extrabold leading-5 text-brand-deep sm:text-base">
          {row.title}
        </p>
        <p className="mt-1 break-all text-[11px] font-semibold leading-4 text-tesText-muted sm:text-xs">
          {row.subtitle || `Identificação ${shortId(row.id)}`}
        </p>
      </div>
    </div>
  );
}

function ProfessionalStatus({ status }: { status?: string }) {
  const label = formatStatusLabel(status) || "Status não identificado";
  const treatment = statusTreatment(status);

  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${treatment.dot}`}
      />
      <div>
        <p className={`text-sm font-extrabold leading-5 ${treatment.text}`}>
          {label}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold leading-4 text-tesText-muted sm:text-xs">
          {statusHint(status)}
        </p>
      </div>
    </div>
  );
}

function CompactPair({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <p
      className={`text-sm font-semibold leading-5 text-tesText-secondary ${className}`}
    >
      <span className="font-extrabold text-brand-deep">{label}:</span> {value}
    </p>
  );
}

function EntityField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-tesText-muted sm:text-xs">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-5 text-brand-deep">
        {value}
      </dd>
    </div>
  );
}

function ProfessionalsState({
  action,
  message,
  title,
  tone = "muted",
}: {
  action?: { href: string; label: string };
  message: string;
  title: string;
  tone?: "muted" | "warning";
}) {
  return (
    <div className="grid min-h-[250px] place-items-center px-5 py-10 text-center">
      <div className="max-w-md">
        <span
          aria-hidden="true"
          className={`mx-auto block size-3 rounded-full ${
            tone === "warning" ? "bg-status-warning" : "bg-brand-primary"
          }`}
        />
        <h3 className="mt-4 text-xl font-extrabold text-brand-deep">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {message}
        </p>
        {action ? (
          <Link
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
            href={action.href as Route<string>}
          >
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ProfessionalsPagination({ data }: { data: AdminOperationPageData }) {
  const start = (data.page.page - 1) * data.page.pageSize + 1;
  const end = Math.min(data.page.page * data.page.pageSize, data.page.total);
  const previousHref = buildAdminListHref(data.listHref, data.query, {
    page: Math.max(data.page.page - 1, 1),
  });
  const nextHref = buildAdminListHref(data.listHref, data.query, {
    page: data.page.page + 1,
  });

  return (
    <nav
      aria-label="Paginação de profissionais"
      className="flex flex-col gap-3 border-t border-border px-4 py-4 text-sm font-semibold text-tesText-secondary sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6"
    >
      <p>
        Mostrando {start}–{end} de {data.page.total} profissionais
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
    </nav>
  );
}

function getField(row: AdminOperationRow, label: string) {
  return row.fields.find((field) => field.label === label)?.value ?? "";
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "PR";
}

function shortId(id: string) {
  return id ? id.slice(0, 8) : "não informada";
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

function statusTreatment(status?: string) {
  if (status === "approved") {
    return { dot: "bg-status-success", text: "text-status-success" };
  }

  if (status === "submitted" || status === "in_review") {
    return { dot: "bg-status-info", text: "text-status-info" };
  }

  if (status === "changes_requested" || status === "draft") {
    return { dot: "bg-status-warning", text: "text-status-warning" };
  }

  if (status === "rejected" || status === "suspended") {
    return { dot: "bg-status-danger", text: "text-status-danger" };
  }

  return { dot: "bg-tesText-muted", text: "text-tesText-secondary" };
}

function statusHint(status?: string) {
  const hints: Record<string, string> = {
    approved: "Cadastro aprovado",
    changes_requested: "Aguardando ajustes",
    draft: "Cadastro em andamento",
    in_review: "Análise em andamento",
    rejected: "Decisão registrada",
    submitted: "Revisão pendente",
    suspended: "Acesso suspenso",
  };

  return status
    ? (hints[status] ?? "Acompanhamento operacional")
    : "Estado ainda não informado";
}

function paginationLinkClass(disabled: boolean) {
  const base =
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border px-3 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 sm:flex-none";

  return disabled
    ? `${base} pointer-events-none border-border bg-surface-muted text-tesText-muted`
    : `${base} border-brand-lavender bg-white text-brand-primary hover:border-brand-primary hover:bg-brand-lavenderSoft`;
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
