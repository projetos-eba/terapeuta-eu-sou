import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  Headphones,
  Search,
} from "lucide-react";

import { ProductPagination } from "./admin-operation-display";

import type {
  AdminOperationMetric,
  AdminOperationPageData,
  AdminOperationRow,
} from "../admin-operations.types";

type SupportedModule = "sessions" | "support";

type PageConfig = {
  emptyTitle: string;
  eyebrow: string;
  listDescription: string;
  listTitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  subtitle: string;
  summaryDescription: string;
  summaryTitle: string;
};

const PAGE_CONFIG: Record<SupportedModule, PageConfig> = {
  sessions: {
    emptyTitle: "Nenhuma sessão encontrada",
    eyebrow: "Admin",
    listDescription:
      "Consulte agenda, participantes, pagamento e status em uma única visão.",
    listTitle: "Agenda de sessões",
    searchLabel: "Buscar sessões",
    searchPlaceholder: "Buscar por sessão, profissional ou cliente",
    subtitle:
      "Acompanhe a agenda da plataforma e identifique rapidamente sessões que precisam de atenção.",
    summaryDescription:
      "Distribuição dos registros exibidos, sem extrapolar os resultados desta página.",
    summaryTitle: "Status nesta página",
  },
  support: {
    emptyTitle: "Nenhuma solicitação encontrada",
    eyebrow: "Admin",
    listDescription:
      "Acompanhe assunto, solicitante, prioridade e andamento sem expor conteúdo sensível.",
    listTitle: "Fila de atendimento",
    searchLabel: "Buscar solicitações",
    searchPlaceholder: "Buscar por assunto, solicitante ou categoria",
    subtitle:
      "Organize solicitações, acompanhe prioridades e mantenha o atendimento claro e responsável.",
    summaryDescription:
      "Distribuição dos atendimentos exibidos para apoiar a leitura operacional.",
    summaryTitle: "Andamento nesta página",
  },
};

export function AdminOperationalOverviewPage({
  data,
  module,
}: {
  data: AdminOperationPageData;
  module: SupportedModule;
}) {
  const config = PAGE_CONFIG[module];
  const breakdown = buildStatusBreakdown(data.rows);

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-[1166px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.42em] text-brand-primary">
              {config.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-[3.5rem] font-normal italic leading-[0.95] text-brand-deep sm:text-[4.75rem]">
              {data.title}
            </h1>
            <p className="mt-4 max-w-[820px] text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
              {config.subtitle}
            </p>
          </div>
          <p className="w-fit rounded-[18px] border border-brand-lavender/70 bg-white px-4 py-3 text-sm font-bold text-tesText-secondary shadow-[0_18px_45px_rgba(20,16,90,0.08)]">
            Atualizado em {formatDateTime(data.generatedAt)}
          </p>
        </header>

        <section
          aria-label={`Indicadores de ${data.title.toLowerCase()}`}
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {data.metrics.map((metric, index) => (
            <MetricCard
              index={index}
              key={metric.key}
              metric={metric}
              module={module}
            />
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <article className="rounded-[26px] border border-brand-lavender/70 bg-white p-5 shadow-[0_24px_70px_rgba(20,16,90,0.09)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-[18px] bg-brand-lavenderSoft text-brand-primary">
                {module === "sessions" ? (
                  <CalendarDays aria-hidden="true" className="size-5" />
                ) : (
                  <Headphones aria-hidden="true" className="size-5" />
                )}
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-brand-deep">
                  {config.summaryTitle}
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  {config.summaryDescription}
                </p>
              </div>
            </div>

            {data.rowsStatus === "available" && breakdown.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {breakdown.map((item) => (
                  <div
                    className="flex items-center justify-between gap-4 rounded-[18px] border border-brand-lavender/60 bg-surface-soft p-4"
                    key={item.label}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`size-2.5 shrink-0 rounded-full ${item.colorClass}`}
                      />
                      <span className="truncate text-sm font-extrabold text-brand-deep">
                        {item.label}
                      </span>
                    </div>
                    <strong className="text-lg font-extrabold text-brand-deep">
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-[18px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                O resumo será exibido quando houver registros disponíveis.
              </p>
            )}
          </article>

          <article className="rounded-[26px] border border-brand-lavender/70 bg-white p-5 shadow-[0_24px_70px_rgba(20,16,90,0.09)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-[18px] bg-status-successBg text-status-success">
                <AlertCircle aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-brand-deep">
                  Leitura responsável
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  Informações essenciais para acompanhar a operação com
                  segurança.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {productNotes(module).map((note) => (
                <p
                  className="rounded-[18px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary"
                  key={note}
                >
                  {note}
                </p>
              ))}
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-brand-lavender/70 bg-white shadow-[0_24px_70px_rgba(20,16,90,0.11)]">
          <div className="border-b border-brand-lavender/60 px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-brand-deep">
                  {config.listTitle}
                </h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  {config.listDescription}
                </p>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-tesText-muted">
                {data.page.total} registro{data.page.total === 1 ? "" : "s"}
              </p>
            </div>

            <ListFilters config={config} data={data} />
          </div>

          <RowsContent data={data} module={module} />
          <ProductPagination data={data} />
        </section>
      </div>
    </main>
  );
}

function ListFilters({
  config,
  data,
}: {
  config: PageConfig;
  data: AdminOperationPageData;
}) {
  return (
    <form
      action={data.listHref}
      className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]"
      method="get"
    >
      <label className="relative block">
        <span className="sr-only">{config.searchLabel}</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
        />
        <input
          className="min-h-12 w-full rounded-full border border-brand-lavender bg-surface-soft py-2 pl-11 pr-4 text-sm font-semibold text-brand-deep outline-none transition placeholder:text-tesText-muted focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-ring/20"
          defaultValue={data.query.search}
          name="q"
          placeholder={config.searchPlaceholder}
          type="search"
        />
      </label>
      <label>
        <span className="sr-only">Filtrar por status</span>
        <select
          className="min-h-12 w-full rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
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
        <span className="sr-only">Ordenar resultados</span>
        <select
          className="min-h-12 w-full rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
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
        <input name="pageSize" type="hidden" value={data.query.pageSize} />
        <button
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
          type="submit"
        >
          Aplicar
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

function RowsContent({
  data,
  module,
}: {
  data: AdminOperationPageData;
  module: SupportedModule;
}) {
  if (data.rowsStatus === "forbidden") {
    return (
      <StateMessage
        message="Seu acesso atual não permite consultar estes registros."
        title="Acesso restrito"
      />
    );
  }

  if (data.rowsStatus === "unavailable") {
    return (
      <StateMessage
        message="Não foi possível carregar estes registros agora. Tente novamente em alguns instantes."
        title="Conteúdo temporariamente indisponível"
      />
    );
  }

  if (data.rows.length === 0) {
    return (
      <StateMessage
        message={
          module === "sessions"
            ? "Nenhuma sessão corresponde aos filtros selecionados."
            : "Nenhuma solicitação corresponde aos filtros selecionados."
        }
        title={PAGE_CONFIG[module].emptyTitle}
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        {module === "sessions" ? (
          <SessionsTable rows={data.rows} />
        ) : (
          <SupportTable rows={data.rows} />
        )}
      </div>
      <div className="divide-y divide-brand-lavender/60 lg:hidden">
        {data.rows.map((row) => (
          <MobileRow key={row.id} module={module} row={row} />
        ))}
      </div>
    </>
  );
}

function SessionsTable({ rows }: { rows: AdminOperationRow[] }) {
  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="bg-surface-soft text-left text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
          <th className="w-[25%] px-5 py-4">Sessão</th>
          <th className="w-[17%] px-4 py-4">Profissional</th>
          <th className="w-[17%] px-4 py-4">Cliente</th>
          <th className="w-[17%] px-4 py-4">Horário</th>
          <th className="w-[12%] px-4 py-4">Status</th>
          <th className="w-[12%] px-5 py-4 text-right">Ação</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const fields = rowFields(row);
          return (
            <tr
              className="border-t border-brand-lavender/60 align-top transition hover:bg-surface-soft/70"
              key={row.id}
            >
              <td className="px-5 py-4">
                <p className="break-words text-sm font-extrabold text-brand-deep">
                  {row.title}
                </p>
                <p className="mt-1 text-xs font-semibold text-tesText-muted">
                  {fields.Pagamento
                    ? `Pagamento: ${productLabel(fields.Pagamento)}`
                    : "Pagamento não informado"}
                </p>
              </td>
              <td className="break-words px-4 py-4 text-sm font-semibold text-brand-deep">
                {fields.Terapeuta || "Não informado"}
              </td>
              <td className="break-words px-4 py-4 text-sm font-semibold text-brand-deep">
                {fields.Cliente || "Não informado"}
              </td>
              <td className="px-4 py-4">
                <p className="text-sm font-extrabold text-brand-deep">
                  {fields["Início"] || "Não informado"}
                </p>
                <p className="mt-1 text-xs font-semibold text-tesText-muted">
                  {fields["Duração"] || "Duração não informada"}
                </p>
              </td>
              <td className="px-4 py-4">
                <StatusBadge label={row.statusLabel} />
              </td>
              <td className="px-5 py-4 text-right">
                <DetailLink href={row.detailHref} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SupportTable({ rows }: { rows: AdminOperationRow[] }) {
  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr className="bg-surface-soft text-left text-xs font-bold uppercase tracking-[0.12em] text-tesText-muted">
          <th className="w-[29%] px-5 py-4">Solicitação</th>
          <th className="w-[19%] px-4 py-4">Solicitante</th>
          <th className="w-[17%] px-4 py-4">Categoria</th>
          <th className="w-[13%] px-4 py-4">Prioridade</th>
          <th className="w-[12%] px-4 py-4">Status</th>
          <th className="w-[10%] px-5 py-4 text-right">Ação</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const fields = rowFields(row);
          return (
            <tr
              className="border-t border-brand-lavender/60 align-top transition hover:bg-surface-soft/70"
              key={row.id}
            >
              <td className="px-5 py-4">
                <p className="break-words text-sm font-extrabold text-brand-deep">
                  {row.title}
                </p>
                <p className="mt-1 text-xs font-semibold text-tesText-muted">
                  Atualizado em {fields.Atualizado || "data indisponível"}
                </p>
              </td>
              <td className="px-4 py-4">
                <p className="break-words text-sm font-extrabold text-brand-deep">
                  {fields.Solicitante || "Não informado"}
                </p>
                <p className="mt-1 text-xs font-semibold text-tesText-muted">
                  {productLabel(fields.Perfil) || "Perfil não informado"}
                </p>
              </td>
              <td className="break-words px-4 py-4 text-sm font-semibold text-brand-deep">
                {productLabel(fields.Categoria) || "Não informada"}
              </td>
              <td className="px-4 py-4">
                <PriorityBadge
                  label={fields.Prioridade || fields["Urgência"]}
                />
              </td>
              <td className="px-4 py-4">
                <StatusBadge label={row.statusLabel} />
              </td>
              <td className="px-5 py-4 text-right">
                <DetailLink href={row.detailHref} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MobileRow({
  module,
  row,
}: {
  module: SupportedModule;
  row: AdminOperationRow;
}) {
  const fields = rowFields(row);
  const visibleFields =
    module === "sessions"
      ? ["Terapeuta", "Cliente", "Início", "Duração", "Pagamento"]
      : ["Solicitante", "Perfil", "Categoria", "Prioridade", "Atualizado"];

  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-extrabold text-brand-deep">
            {row.title}
          </h3>
          {module === "support" && row.subtitle ? (
            <p className="mt-1 text-xs font-semibold text-tesText-muted">
              {row.subtitle}
            </p>
          ) : null}
        </div>
        <StatusBadge label={row.statusLabel} />
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {visibleFields.map((label) => (
          <div key={`${row.id}-${label}`}>
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-tesText-muted">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-brand-deep">
              {productLabel(fields[label]) || "Não informado"}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-end">
        <DetailLink href={row.detailHref} />
      </div>
    </article>
  );
}

function MetricCard({
  index,
  metric,
  module,
}: {
  index: number;
  metric: AdminOperationMetric;
  module: SupportedModule;
}) {
  const Icon = module === "sessions" ? CalendarDays : Headphones;
  const accent = metricAccent(metric, index);

  return (
    <article className="rounded-[24px] border border-brand-lavender/70 bg-white p-5 shadow-[0_20px_55px_rgba(20,16,90,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid size-12 place-items-center rounded-[18px] ${accent}`}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="rounded-full bg-surface-soft px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
          {metric.status === "available" ? "Atual" : "Indisponível"}
        </span>
      </div>
      <p className="mt-5 text-sm font-extrabold text-tesText-secondary">
        {metricLabel(metric)}
      </p>
      <strong className="mt-2 block text-[2.2rem] font-extrabold leading-none text-brand-deep">
        {metric.status === "available"
          ? metric.value
          : metric.status === "forbidden"
            ? "Restrito"
            : "—"}
      </strong>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-muted">
        {metricDescription(metric)}
      </p>
    </article>
  );
}

function StateMessage({ message, title }: { message: string; title: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center px-6 py-10 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Clock3 aria-hidden="true" className="size-6" />
        </span>
        <h3 className="mt-4 text-xl font-extrabold text-brand-deep">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {message}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ label }: { label?: string }) {
  const text = productLabel(label) || "Não informado";
  const normalized = (label ?? "").toLowerCase();
  const tone =
    normalized.includes("confirm") ||
    normalized.includes("complete") ||
    normalized.includes("resolved")
      ? "bg-status-successBg text-status-success"
      : normalized.includes("cancel") || normalized.includes("refund")
        ? "bg-status-dangerBg text-status-danger"
        : normalized.includes("pending") ||
            normalized.includes("progress") ||
            normalized.includes("open")
          ? "bg-status-warningBg text-status-warning"
          : "bg-brand-lavenderSoft text-brand-primary";

  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-extrabold ${tone}`}
    >
      {text}
    </span>
  );
}

function PriorityBadge({ label }: { label?: string }) {
  const normalized = (label ?? "").toLowerCase();
  const tone =
    normalized.includes("urgent") ||
    normalized.includes("high") ||
    normalized.includes("alta")
      ? "bg-status-dangerBg text-status-danger"
      : normalized.includes("medium") || normalized.includes("média")
        ? "bg-status-warningBg text-status-warning"
        : "bg-brand-lavenderSoft text-brand-primary";

  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-extrabold ${tone}`}
    >
      {productLabel(label) || "Normal"}
    </span>
  );
}

function DetailLink({ href }: { href?: string }) {
  if (!href) return <span className="text-sm text-tesText-muted">—</span>;

  return (
    <Link
      aria-label="Ver detalhes do registro"
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
      href={href as Route<string>}
    >
      Ver detalhes
      <ChevronRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

function rowFields(row: AdminOperationRow) {
  return Object.fromEntries(
    row.fields.map((field) => [field.label, field.value]),
  );
}

function buildStatusBreakdown(rows: AdminOperationRow[]) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const label = productLabel(row.statusLabel) || "Não informado";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  const colors = [
    "bg-brand-primary",
    "bg-status-success",
    "bg-status-warning",
    "bg-status-info",
    "bg-status-danger",
  ];

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({
      colorClass: colors[index % colors.length],
      label,
      value,
    }));
}

function productNotes(module: SupportedModule) {
  return module === "sessions"
    ? [
        "Dados de acesso ao encontro permanecem protegidos e não aparecem nesta visão.",
        "Cancelamentos, reembolsos e reagendamentos devem ser tratados no fluxo correspondente.",
      ]
    : [
        "O conteúdo completo da solicitação fica protegido até a abertura do detalhe.",
        "Mudanças de status preservam o histórico do atendimento.",
      ];
}

function metricLabel(metric: AdminOperationMetric) {
  const labels: Record<string, string> = {
    "attention-sessions": "Sessões com atenção",
    "future-sessions": "Próximas sessões",
    "open-support": "Atendimentos abertos",
    "total-sessions": "Sessões registradas",
    "total-support": "Solicitações recebidas",
    "urgent-support": "Prioridade alta",
  };
  return labels[metric.key] ?? metric.label;
}

function metricDescription(metric: AdminOperationMetric) {
  const descriptions: Record<string, string> = {
    "attention-sessions": "Registros que pedem acompanhamento operacional.",
    "future-sessions": "Sessões com início previsto para o futuro.",
    "open-support": "Solicitações que ainda aguardam conclusão.",
    "total-sessions": "Volume disponível para acompanhamento.",
    "total-support": "Volume disponível para acompanhamento.",
    "urgent-support": "Solicitações marcadas com maior urgência.",
  };
  return descriptions[metric.key] ?? metric.description;
}

function metricAccent(metric: AdminOperationMetric, index: number) {
  if (metric.tone === "danger") {
    return "bg-status-dangerBg text-status-danger";
  }
  if (metric.tone === "warning") {
    return "bg-status-warningBg text-status-warning";
  }
  if (metric.tone === "success") {
    return "bg-status-successBg text-status-success";
  }
  return index % 2 === 0
    ? "bg-brand-lavenderSoft text-brand-primary"
    : "bg-status-infoBg text-status-info";
}

function productLabel(value?: string) {
  if (!value) return "";
  const labels: Record<string, string> = {
    admin: "Administração",
    cancelled_by_patient: "Cancelada pelo cliente",
    cancelled_by_therapist: "Cancelada pelo profissional",
    closed: "Fechado",
    completed: "Concluída",
    confirmed: "Confirmada",
    high: "Alta",
    in_progress: "Em andamento",
    in_review: "Em análise",
    low: "Baixa",
    medium: "Média",
    open: "Aberto",
    paid: "Confirmado",
    patient: "Cliente",
    payment: "Financeiro",
    pending: "Pendente",
    pending_payment: "Pagamento pendente",
    refunded: "Reembolsada",
    resolved: "Resolvido",
    technical: "Suporte técnico",
    therapist: "Profissional",
    urgent: "Urgente",
  };
  const normalized = value.trim().toLowerCase();
  if (labels[normalized]) return labels[normalized];
  const readable = value.replaceAll("_", " ").trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
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
