import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Search,
  Star,
} from "lucide-react";

import type {
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";
import {
  EditorialHeader,
  HonestState,
  ProductBadge,
  ProductPagination,
  StatsGrid,
  formatStatusLabel,
} from "./admin-operation-display";

const RATING_OPTIONS = [
  { label: "Todas as notas", value: "" },
  { label: "5 estrelas", value: "5" },
  { label: "4 estrelas", value: "4" },
  { label: "3 estrelas", value: "3" },
  { label: "2 estrelas", value: "2" },
  { label: "1 estrela", value: "1" },
];

export function AdminReviewsPage({
  data,
}: {
  data: AdminOperationPageData;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-[1166px] space-y-6">
        <EditorialHeader
          subtitle="Acompanhe as avaliações publicadas e as que precisam de moderação, mantendo o conteúdo detalhado apenas no registro individual."
          title="Avaliações"
        />

        <StatsGrid items={reviewMetrics(data.metrics)} />

        <section className="overflow-hidden rounded-[28px] border border-brand-lavender/70 bg-white shadow-[0_24px_70px_rgba(20,16,90,0.11)]">
          <div className="border-b border-brand-lavender/60 px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-brand-deep">
                    Avaliações recentes
                  </h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    Filtre os registros por situação ou nota e abra o detalhe
                    quando precisar analisar uma avaliação.
                  </p>
                </div>
                <p className="flex items-center gap-2 text-sm font-bold text-tesText-secondary">
                  <CalendarDays aria-hidden="true" className="size-4 text-brand-primary" />
                  Atualizado em {formatDateTime(data.generatedAt)}
                </p>
              </div>

              <form
                action={data.listHref}
                className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_170px_180px_auto]"
                method="get"
              >
                <label className="relative block">
                  <span className="sr-only">Buscar avaliações</span>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
                  />
                  <input
                    className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft py-2 pl-11 pr-4 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
                    defaultValue={data.query.search}
                    name="q"
                    placeholder="Buscar por profissional, situação ou identificação"
                    type="search"
                  />
                </label>
                <SelectFilter
                  label="Filtrar por situação"
                  name="status"
                  options={data.filterOptions.status}
                  value={data.query.status}
                />
                <SelectFilter
                  label="Filtrar por nota"
                  name="rating"
                  options={RATING_OPTIONS}
                  value={data.query.rating ?? ""}
                />
                <SelectFilter
                  label="Ordenar avaliações"
                  name="sort"
                  options={data.filterOptions.sort}
                  value={data.query.sort || "recent"}
                />
                <div className="flex gap-2">
                  <input name="pageSize" type="hidden" value={data.query.pageSize} />
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
          </div>

          {data.rowsStatus === "forbidden" ? (
            <HonestState
              message="Seu acesso atual não permite consultar avaliações."
              title="Acesso restrito"
              tone="warning"
            />
          ) : data.rowsStatus === "unavailable" ? (
            <HonestState
              message="Não foi possível carregar as avaliações agora. Tente novamente em alguns instantes."
              title="Avaliações indisponíveis"
              tone="warning"
            />
          ) : data.rows.length === 0 ? (
            <HonestState
              message={emptyMessage(data)}
              title="Nenhuma avaliação encontrada"
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[850px] text-left">
                  <caption className="sr-only">
                    Lista operacional de avaliações
                  </caption>
                  <thead className="border-b border-brand-lavender/60 bg-surface-soft/80">
                    <tr>
                      {[
                        "Avaliação",
                        "Profissional",
                        "Nota",
                        "Situação",
                        "Data",
                        "Ação",
                      ].map((label) => (
                        <th
                          className={`px-3 py-4 text-[11px] font-extrabold uppercase tracking-[0.06em] text-tesText-secondary first:pl-5 last:pr-5 lg:first:pl-6 lg:last:pr-6 ${
                            label === "Ação"
                              ? "sticky right-0 z-10 bg-surface-soft shadow-[-12px_0_18px_-18px_rgba(20,16,90,0.45)]"
                              : ""
                          }`}
                          key={label}
                          scope="col"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-lavender/60">
                    {data.rows.map((row) => (
                      <DesktopReviewRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4 p-4 lg:hidden">
                {data.rows.map((row) => (
                  <MobileReviewCard key={row.id} row={row} />
                ))}
              </div>
            </>
          )}

          <ProductPagination data={data} />
        </section>
      </div>
    </main>
  );
}

function reviewMetrics(metrics: AdminOperationMetric[]) {
  const icons = {
    "pending-reviews": Clock3,
    "published-reviews": CheckCircle2,
    "total-reviews": Star,
  };

  return metrics.map((metric) => ({
    description: metric.description,
    icon: icons[metric.key as keyof typeof icons] ?? Star,
    iconToneClass:
      metric.tone === "success"
        ? "bg-status-successBg text-status-success"
        : metric.tone === "warning"
          ? "bg-status-warningBg text-status-warning"
          : "bg-brand-lavenderSoft text-brand-primary",
    label: metric.label,
    value:
      metric.status === "available" && metric.value !== null
        ? String(metric.value)
        : "Indisponível",
  }));
}

function SelectFilter({
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
        className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
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

function DesktopReviewRow({ row }: { row: AdminOperationRow }) {
  const rating = reviewRating(row);
  const publishedAt = fieldValue(row, "Publicada");
  const createdAt = fieldValue(row, "Criada");

  return (
    <tr className="group align-middle transition hover:bg-surface-soft/70">
      <td className="px-3 py-4 first:pl-5 lg:first:pl-6">
        <p className="text-sm font-extrabold text-brand-deep">Avaliação</p>
        <p className="mt-1 text-xs font-semibold text-tesText-secondary">
          {row.subtitle || "Identificação indisponível"}
        </p>
      </td>
      <td className="min-w-[220px] px-3 py-4 text-sm font-extrabold text-brand-deep">
        {fieldValue(row, "Terapeuta") || "Profissional não identificado"}
      </td>
      <td className="px-3 py-4">
        <RatingStars rating={rating} />
      </td>
      <td className="px-3 py-4">
        {row.statusLabel ? (
          <ProductBadge
            label={formatStatusLabel(row.statusLabel)}
            tone={reviewStatusTone(row.statusLabel)}
          />
        ) : (
          <span className="text-sm font-semibold text-tesText-muted">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-tesText-secondary">
        <p>{publishedAt || createdAt || "—"}</p>
        {publishedAt && createdAt ? (
          <p className="mt-1 text-xs text-tesText-muted">Criada {createdAt}</p>
        ) : null}
      </td>
      <td className="sticky right-0 z-[1] bg-white px-3 py-4 shadow-[-12px_0_18px_-18px_rgba(20,16,90,0.45)] transition group-hover:bg-surface-soft last:pr-5 lg:last:pr-6">
        <ReviewAction row={row} />
      </td>
    </tr>
  );
}

function MobileReviewCard({ row }: { row: AdminOperationRow }) {
  const rating = reviewRating(row);

  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-4 shadow-[0_16px_40px_rgba(20,16,90,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-extrabold text-brand-deep">Avaliação</p>
          <p className="mt-1 text-xs font-semibold text-tesText-secondary">
            {row.subtitle || "Identificação indisponível"}
          </p>
        </div>
        {row.statusLabel ? (
          <ProductBadge
            label={formatStatusLabel(row.statusLabel)}
            tone={reviewStatusTone(row.statusLabel)}
          />
        ) : null}
      </div>
      <dl className="mt-4 grid gap-3 border-t border-brand-lavender/60 pt-4 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-tesText-muted">
            Profissional
          </dt>
          <dd className="mt-1 text-sm font-extrabold text-brand-deep">
            {fieldValue(row, "Terapeuta") || "Profissional não identificado"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-tesText-muted">
            Nota
          </dt>
          <dd className="mt-1"><RatingStars rating={rating} /></dd>
        </div>
        <div>
          <dt className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-tesText-muted">
            Data
          </dt>
          <dd className="mt-1 text-sm font-semibold text-tesText-secondary">
            {fieldValue(row, "Publicada") || fieldValue(row, "Criada") || "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-4"><ReviewAction row={row} fullWidth /></div>
    </article>
  );
}

function ReviewAction({
  fullWidth = false,
  row,
}: {
  fullWidth?: boolean;
  row: AdminOperationRow;
}) {
  if (!row.detailHref) {
    return <span className="text-sm font-semibold text-tesText-muted">—</span>;
  }

  return (
    <Link
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-brand-lavender/70 bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20 ${fullWidth ? "w-full" : "whitespace-nowrap"}`}
      href={row.detailHref as Route<string>}
    >
      Ver detalhes
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) {
    return <span className="text-sm font-semibold text-tesText-muted">Sem nota</span>;
  }

  return (
    <span aria-label={`${rating} de 5 estrelas`} className="inline-flex items-center gap-0.5 text-brand-primary">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          aria-hidden="true"
          className={`size-4 ${index < rating ? "fill-current" : "text-brand-lavender"}`}
          key={index}
        />
      ))}
      <span className="ml-1 text-sm font-extrabold text-brand-deep">{rating}</span>
    </span>
  );
}

function reviewRating(row: AdminOperationRow) {
  const value = Number(fieldValue(row, "Nota"));
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

function fieldValue(row: AdminOperationRow, label: string) {
  return row.fields.find((field) => field.label === label)?.value ?? "";
}

function reviewStatusTone(status: string) {
  if (status === "published") return "success" as const;
  if (status === "hidden") return "muted" as const;
  if (status === "pending" || status === "reported") return "warning" as const;
  return "primary" as const;
}

function emptyMessage(data: AdminOperationPageData) {
  if (data.query.search || data.query.status || data.query.rating) {
    return "Não há avaliações que correspondam aos filtros selecionados.";
  }

  return data.emptyMessage;
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
