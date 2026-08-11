import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, CalendarClock, Search, ShieldCheck } from "lucide-react";

import { routes } from "@/lib/routes";

import type {
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";
import {
  AsideCard,
  EditorialHeader,
  HonestState,
  ProductBackLink,
  ProductBadge,
  ProductBreadcrumbs,
  ProductPagination,
  formatDateTime,
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

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                      placeholder="Buscar por profissional ou identificador"
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
                <div className="hidden divide-y divide-brand-lavender/60 lg:block">
                  {data.rows.map((row) => (
                    <DesktopVerificationRow key={row.id} row={row} />
                  ))}
                </div>
                <div className="grid gap-4 p-4 lg:hidden">
                  {data.rows.map((row) => (
                    <MobileVerificationCard key={row.id} row={row} />
                  ))}
                </div>
              </>
            )}

            <ProductPagination data={data} />
          </div>

          <AsideCard title="Como funciona a revisão">
            <div className="space-y-3">
              <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                <strong className="text-brand-deep">
                  1. Aguardando análise:
                </strong>{" "}
                o profissional publicou o perfil e entrou na fila de revisão.
              </p>
              <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                <strong className="text-brand-deep">2. Em análise:</strong> abra
                o cadastro, confira as informações disponíveis e registre o
                início da revisão.
              </p>
              <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                <strong className="text-brand-deep">3. Decisão:</strong> aprove
                o profissional, solicite ajustes ou registre a não aprovação com
                um motivo claro.
              </p>
            </div>
          </AsideCard>
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
  const submitted = getFieldValue(row, "Enviado");
  const reviewed = getFieldValue(row, "Revisado");
  const updated = getFieldValue(row, "Atualizado");

  return (
    <article className="px-5 py-4 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-brand-deep">
              {row.title}
            </h3>
            {row.statusLabel ? (
              <ProductBadge
                label={formatStatusLabel(row.statusLabel)}
                tone={statusTone(row.statusLabel)}
              />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold text-tesText-secondary">
            {submitted ? <span>Enviado em {submitted}</span> : null}
            {reviewed ? <span>Última revisão em {reviewed}</span> : null}
            {!reviewed && updated ? <span>Atualizado em {updated}</span> : null}
          </div>
        </div>

        {row.detailHref ? (
          <Link
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-brand-lavender/70 bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
            href={row.detailHref as Route<string>}
          >
            Abrir análise
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function MobileVerificationCard({ row }: { row: AdminOperationRow }) {
  const submitted = getFieldValue(row, "Enviado");
  const reviewed = getFieldValue(row, "Revisado");
  const updated = getFieldValue(row, "Atualizado");

  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-4 shadow-[0_16px_40px_rgba(20,16,90,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-brand-deep">
            {row.title}
          </h3>
          {row.statusLabel ? (
            <div className="mt-3">
              <ProductBadge
                label={formatStatusLabel(row.statusLabel)}
                tone={statusTone(row.statusLabel)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm font-semibold text-tesText-secondary">
        {submitted ? <p>Enviado em {submitted}</p> : null}
        {reviewed ? <p>Última revisão em {reviewed}</p> : null}
        {!reviewed && updated ? <p>Atualizado em {updated}</p> : null}
      </div>

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

function getFieldValue(row: AdminOperationRow, label: string) {
  return row.fields.find((field) => field.label === label)?.value ?? "";
}

function statusTone(status?: string) {
  const label = formatStatusLabel(status);

  if (label === "Aprovado") return "success" as const;
  if (label === "Não aprovado") return "danger" as const;
  if (label === "Em análise" || label === "Ajustes solicitados") {
    return "warning" as const;
  }
  return "primary" as const;
}
