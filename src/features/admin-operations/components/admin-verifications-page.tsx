import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, CalendarClock, Search } from "lucide-react";

import { routes } from "@/lib/routes";

import type {
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";
import {
  EditorialHeader,
  HonestState,
  ProductBackLink,
  ProductBadge,
  ProductBreadcrumbs,
  ProductPagination,
  formatStatusLabel,
} from "./admin-operation-display";

export function AdminVerificationsPage({
  data,
}: {
  data: AdminOperationPageData;
}) {
  const metrics = data.metrics.filter(
    (metric) =>
      metric.key === "total-verifications" ||
      metric.key === "pending-verifications",
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-[1166px] space-y-6">
        <div className="space-y-4">
          <ProductBackLink
            href={routes.admin.professionals}
            label="Voltar para profissionais"
          />
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.professionals, label: "Profissionais" },
              { label: "Verificações" },
            ]}
          />
          <EditorialHeader
            subtitle="Analise os perfis publicados que aguardam uma decisão administrativa e acompanhe os ajustes solicitados."
            title="Verificações de profissionais"
          />
        </div>

        <section className="grid gap-5 md:grid-cols-2">
          {metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </section>

        <section>
          <div className="overflow-hidden rounded-[28px] border border-brand-lavender/70 bg-white shadow-[0_24px_70px_rgba(20,16,90,0.11)]">
            <div className="border-b border-brand-lavender/60 px-5 py-5 lg:px-6">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-brand-deep">
                    Fila de revisão
                  </h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    Use os filtros atuais para localizar um cadastro e abrir o
                    detalhe com as ações disponíveis.
                  </p>
                </div>

                <form
                  action={data.listHref}
                  className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]"
                  method="get"
                >
                  <label className="relative block">
                    <span className="sr-only">Buscar verificações</span>
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
                    />
                    <input
                      className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft py-2 pl-11 pr-4 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
                      defaultValue={data.query.search}
                      name="q"
                      placeholder="Buscar por profissional, e-mail ou ID"
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
                        <option
                          key={option.value || "all"}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Ordenar verificações</span>
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
            </div>

            {data.rowsStatus === "forbidden" ? (
              <HonestState
                message="Seu acesso atual não permite abrir esta fila."
                title="Acesso restrito"
                tone="warning"
              />
            ) : data.rowsStatus === "unavailable" ? (
              <HonestState
                message="Não foi possível carregar a fila agora. Tente novamente em alguns instantes."
                title="Fila indisponível"
                tone="warning"
              />
            ) : data.rows.length === 0 ? (
              <HonestState
                message={getEmptyQueueMessage(data)}
                title="Nenhum cadastro na fila"
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto xl:block">
                  <table className="w-full min-w-[760px] text-left">
                    <caption className="sr-only">
                      Profissionais em verificação
                    </caption>
                    <thead className="border-b border-brand-lavender/60 bg-surface-soft/80">
                      <tr>
                        {[
                          "Profissional",
                          "Data de cadastro",
                          "Situação",
                          "Pendência",
                          "Última movimentação",
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
                        <DesktopVerificationRow key={row.id} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-4 p-4 xl:hidden">
                  {data.rows.map((row) => (
                    <MobileVerificationCard key={row.id} row={row} />
                  ))}
                </div>
              </>
            )}

            <ProductPagination data={data} />
          </div>

        </section>
      </div>
    </main>
  );
}

function getEmptyQueueMessage(data: AdminOperationPageData) {
  if (data.query.search || data.query.status) {
    return "Não há cadastros que correspondam aos filtros selecionados.";
  }

  return "Não há profissionais aguardando revisão neste momento. Novos perfis publicados aparecerão aqui automaticamente.";
}

function MetricCard({ metric }: { metric: AdminOperationMetric }) {
  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_22px_55px_rgba(20,16,90,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-12 place-items-center rounded-[18px] bg-brand-lavenderSoft text-brand-primary">
          <CalendarClock aria-hidden="true" className="size-5" />
        </span>
        <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
          {metric.status === "available" ? "Atual" : "Indisponível"}
        </span>
      </div>
      <p className="mt-5 text-sm font-extrabold text-tesText-secondary">
        {metric.label}
      </p>
      <p className="mt-2 text-[2.55rem] font-extrabold leading-none text-brand-deep">
        {metric.status === "available" && metric.value !== null
          ? metric.value
          : "Indisponível"}
      </p>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-muted">
        {metric.description}
      </p>
    </article>
  );
}

function DesktopVerificationRow({ row }: { row: AdminOperationRow }) {
  const email = row.email || getFieldValue(row, "E-mail");
  const professionalId = getFieldValue(row, "ID do terapeuta");
  const registeredAt = getFieldValue(row, "Data de cadastro");
  const pending = getFieldValue(row, "Pendência");
  const updated = getFieldValue(row, "Última movimentação");

  return (
    <tr className="group align-middle transition hover:bg-surface-soft/70">
      <td className="min-w-[280px] px-3 py-4 first:pl-5 lg:first:pl-6">
        <div className="flex min-w-0 items-center gap-3">
          <VerificationAvatar row={row} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-extrabold leading-5 text-brand-deep">
              {row.title}
            </p>
            {professionalId ? (
              <p className="mt-1 break-all text-xs font-semibold leading-4 text-tesText-muted">
                ID: {professionalId}
              </p>
            ) : null}
            {email ? (
              <p
                className="mt-0.5 truncate text-xs font-semibold text-tesText-secondary"
                title={email}
              >
                {email}
              </p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-tesText-secondary">
        {registeredAt || "—"}
      </td>
      <td className="px-3 py-4">
        {row.statusLabel ? (
          <ProductBadge
            label={formatStatusLabel(row.statusLabel)}
            tone={statusTone(row.statusLabel)}
          />
        ) : (
          <span className="text-sm font-semibold text-tesText-muted">—</span>
        )}
      </td>
      <td className="max-w-[165px] px-3 py-4 text-sm font-semibold leading-5 text-tesText-secondary">
        <span className="line-clamp-2">{pending || "—"}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-tesText-secondary">
        {updated || "—"}
      </td>
      <td className="sticky right-0 z-[1] bg-white px-3 py-4 shadow-[-12px_0_18px_-18px_rgba(20,16,90,0.45)] transition group-hover:bg-surface-soft last:pr-5 lg:last:pr-6">
        {row.detailHref ? (
          <Link
            className="inline-flex min-h-10 whitespace-nowrap items-center gap-1.5 rounded-full border border-brand-lavender/70 bg-white px-3 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
            href={row.detailHref as Route<string>}
          >
            Abrir análise
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          <span className="text-sm font-semibold text-tesText-muted">—</span>
        )}
      </td>
    </tr>
  );
}

function MobileVerificationCard({ row }: { row: AdminOperationRow }) {
  const email = row.email || getFieldValue(row, "E-mail");
  const professionalId = getFieldValue(row, "ID do terapeuta");
  const details = [
    { label: "Data de cadastro", value: getFieldValue(row, "Data de cadastro") },
    { label: "Pendência", value: getFieldValue(row, "Pendência") },
    {
      label: "Última movimentação",
      value: getFieldValue(row, "Última movimentação"),
    },
  ].filter((detail) => detail.value);

  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-4 shadow-[0_16px_40px_rgba(20,16,90,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <VerificationAvatar row={row} />
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-brand-deep">
              {row.title}
            </h3>
            {professionalId ? (
              <p className="mt-1 break-all text-xs font-semibold leading-4 text-tesText-muted">
                ID: {professionalId}
              </p>
            ) : null}
            {email ? (
              <p className="mt-0.5 break-words text-xs font-semibold text-tesText-secondary">
                {email}
              </p>
            ) : null}
            {row.statusLabel ? (
              <div className="mt-2">
                <ProductBadge
                  label={formatStatusLabel(row.statusLabel)}
                  tone={statusTone(row.statusLabel)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {details.length > 0 ? (
        <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-brand-lavender/60 pt-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-tesText-muted">
                {detail.label}
              </dt>
              <dd className="mt-1 break-words text-sm font-semibold leading-5 text-tesText-secondary">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {row.detailHref ? (
        <Link
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-brand-lavender/70 bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
          href={row.detailHref as Route<string>}
        >
          Abrir análise
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </article>
  );
}

function VerificationAvatar({ row }: { row: AdminOperationRow }) {
  const initials = row.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  if (row.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photo URL is supplied by the existing protected read model.
      <img
        alt=""
        className="size-10 shrink-0 rounded-full border border-brand-lavender/60 object-cover"
        src={row.avatarUrl}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary"
    >
      {initials || "—"}
    </span>
  );
}

function getFieldValue(row: AdminOperationRow, label: string) {
  return row.fields.find((field) => field.label === label)?.value ?? "";
}

function statusTone(status?: string) {
  const label = formatStatusLabel(status);

  if (label === "Publicado e elegível") return "success" as const;
  if (label === "Não aprovado") return "danger" as const;
  if (label === "Em análise" || label === "Ajustes solicitados") {
    return "warning" as const;
  }
  return "primary" as const;
}
