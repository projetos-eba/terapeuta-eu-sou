import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Clock4,
  Download,
  Filter,
  MoreVertical,
  Route,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { routes } from "@/lib/routes";

import type {
  JourneyClientStatus,
  JourneyHistoryClient,
  JourneyHistoryDetailData,
  JourneyHistoryFilters,
  JourneyHistoryMetric,
  JourneyHistoryPageData,
  JourneyHistoryReminder,
  JourneyHistorySegment,
  JourneyHistorySummary,
} from "./therapist-journey-history.types";

export function TherapistJourneyHistoryPage({
  data,
  filters,
}: {
  data: JourneyHistoryPageData;
  filters: JourneyHistoryFilters;
}) {
  const visibleClients = filterJourneyClients(data.clients, filters);
  const exportHref = buildJourneyCsvHref(visibleClients);

  return (
    <main className="pb-10 text-tesText-primary">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-[38px] font-light italic leading-tight text-brand-deep sm:text-[44px]">
            Clientes
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-brand-primary">
            Gerencie sua carteira, acompanhe a jornada de cada cliente e
            identifique oportunidades de cuidado com mais clareza.
          </p>
        </div>
        <a
          className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary shadow-card transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          download="historico-da-jornada-tes.csv"
          href={exportHref}
        >
          <Download aria-hidden="true" size={17} />
          Exportar
        </a>
      </section>

      <section
        aria-label="Indicadores da carteira"
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {data.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-panel border border-brand-lavender/60 bg-white shadow-card">
          <JourneyFilters
            filters={filters}
            segments={data.segments}
            statusSummary={data.summary}
          />

          {visibleClients.length > 0 ? (
            <>
              <JourneyDesktopTable clients={visibleClients} />
              <JourneyMobileList clients={visibleClients} />
              <footer className="flex flex-col gap-2 border-t border-brand-lavender/60 px-5 py-5 text-xs font-semibold text-tesText-muted sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Mostrando {visibleClients.length} de {data.clients.length}{" "}
                  clientes
                </span>
                <span>Dados privados do terapeuta autenticado.</span>
              </footer>
            </>
          ) : (
            <EmptyFilteredState />
          )}
        </section>

        <aside className="grid content-start gap-5">
          <PortfolioSummary summary={data.summary} />
          <SegmentsCard segments={data.segments} />
          <RemindersCard reminders={data.reminders} />
        </aside>
      </div>
    </main>
  );
}

export function TherapistJourneyDetailPage({
  data,
}: {
  data: JourneyHistoryDetailData;
}) {
  return (
    <main className="pb-10 text-tesText-primary">
      <Link
        className="mb-5 inline-flex text-sm font-extrabold text-brand-primary hover:text-brand-primaryHover"
        href={routes.therapist.patients}
      >
        Voltar para clientes
      </Link>
      <section className="rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <JourneyAvatar client={data.client} size={64} />
            <div className="min-w-0">
              <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[42px]">
                {data.client.name}
              </h1>
              <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                {data.client.totalEncounters} encontros registrados na jornada
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-lavender bg-white px-4 text-xs font-extrabold text-brand-primary hover:bg-brand-lavenderSoft"
              href={data.client.sessionsHref}
            >
              Ver sessões
            </Link>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-xs font-extrabold text-white hover:bg-brand-primaryHover"
              href={routes.therapist.messages}
            >
              Enviar template
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-panel border border-brand-lavender/60 bg-white shadow-card">
          <header className="border-b border-brand-lavender/60 px-5 py-5">
            <h2 className="font-display text-2xl font-light italic text-brand-deep">
              Linha do tempo
            </h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
              Registros operacionais compartilhados por sessão. Esta área não
              substitui prontuário clínico e não exibe chat livre.
            </p>
          </header>
          <div className="divide-y divide-brand-lavender/60">
            {data.timeline.length > 0 ? (
              data.timeline.map((item) => (
                <article
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[140px_minmax(0,1fr)_120px] sm:items-start"
                  key={item.id}
                >
                  <time className="text-xs font-extrabold text-brand-primary">
                    {formatDateTime(item.date)}
                  </time>
                  <div>
                    <h3 className="text-sm font-extrabold text-brand-deep">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
                      {item.description}
                    </p>
                  </div>
                  <Link
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-brand-lavender px-3 text-xs font-extrabold text-brand-primary hover:bg-brand-lavenderSoft"
                    href={item.href}
                  >
                    Abrir sessão
                  </Link>
                </article>
              ))
            ) : (
              <p className="px-5 py-8 text-sm font-semibold text-tesText-secondary">
                Nenhum encontro registrado para esta jornada.
              </p>
            )}
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <SideCard title="Terapias">
            <ChipList items={data.client.therapyLabels} />
          </SideCard>
          <SideCard title="Temas recorrentes">
            <ChipList items={data.client.topicLabels} />
          </SideCard>
          <SideCard title="Próximos passos">
            <p className="text-sm font-semibold leading-6 text-tesText-secondary">
              Use templates aprovados para comunicação e mantenha os registros
              de sessão dentro das superfícies transacionais do TES.
            </p>
          </SideCard>
        </aside>
      </div>
    </main>
  );
}

export function JourneyHistoryState({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <main className="pb-10 text-tesText-primary">
      <section className="rounded-panel border border-brand-lavender/60 bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Route aria-hidden="true" size={22} />
        </span>
        <h1 className="mt-4 font-display text-4xl font-light italic text-brand-deep">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
          {message}
        </p>
      </section>
    </main>
  );
}

function JourneyFilters({
  filters,
  segments,
  statusSummary,
}: {
  filters: JourneyHistoryFilters;
  segments: JourneyHistorySegment[];
  statusSummary: JourneyHistorySummary;
}) {
  return (
    <form
      action={routes.therapist.patients}
      className="grid gap-3 border-b border-brand-lavender/60 p-4 lg:grid-cols-[minmax(240px,1fr)_150px_180px_150px_96px]"
    >
      <label className="relative block">
        <span className="sr-only">Buscar por cliente ou terapia</span>
        <input
          className="h-12 w-full rounded-[18px] border border-brand-lavender/70 bg-white px-4 pr-11 text-sm font-semibold text-brand-deep shadow-card outline-none placeholder:text-tesText-muted focus:border-brand-primary focus:ring-4 focus:ring-brand-lavenderSoft"
          defaultValue={filters.q}
          name="q"
          placeholder="Buscar por cliente ou terapia..."
          type="search"
        />
        <Search
          aria-hidden="true"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary"
          size={18}
        />
      </label>
      <SelectControl
        defaultValue={filters.status}
        icon={<Filter aria-hidden="true" size={16} />}
        name="status"
      >
        <option value="all">Status</option>
        <option value="active">Ativos ({statusSummary.active})</option>
        <option value="paused">Pausados ({statusSummary.paused})</option>
        <option value="stale">Sem retorno ({statusSummary.stale})</option>
      </SelectControl>
      <SelectControl defaultValue={filters.segment} name="segment">
        <option value="">Segmentos</option>
        {segments.map((segment) => (
          <option key={segment.id} value={segment.label}>
            {segment.label}
          </option>
        ))}
      </SelectControl>
      <SelectControl defaultValue={filters.sort} name="sort">
        <option value="last_session">Ordenar: Data</option>
        <option value="name">Ordenar: Nome</option>
        <option value="next_session">Próxima sessão</option>
        <option value="sessions">Encontros</option>
      </SelectControl>
      <button className="inline-flex h-12 items-center justify-center rounded-[18px] bg-brand-primary px-4 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary">
        Filtrar
      </button>
    </form>
  );
}

function SelectControl({
  children,
  defaultValue,
  icon,
  name,
}: {
  children: ReactNode;
  defaultValue: string;
  icon?: ReactNode;
  name: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{name}</span>
      {icon ? (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary">
          {icon}
        </span>
      ) : null}
      <select
        className={`h-12 w-full appearance-none rounded-[18px] border border-brand-lavender/70 bg-white ${icon ? "pl-10" : "pl-4"} pr-9 text-xs font-extrabold text-brand-primary shadow-card outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-lavenderSoft`}
        defaultValue={defaultValue}
        name={name}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary"
        size={15}
      />
    </label>
  );
}

function JourneyDesktopTable({ clients }: { clients: JourneyHistoryClient[] }) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="min-w-[900px] table-fixed text-left">
        <thead>
          <tr className="border-b border-brand-lavender/60 text-[11px] font-extrabold text-[#4d2861]">
            <th className="w-[210px] px-5 py-5">Cliente</th>
            <th className="w-[94px] px-3 py-5">Status</th>
            <th className="w-[150px] px-3 py-5">Terapias</th>
            <th className="w-[100px] px-3 py-5">Última sessão</th>
            <th className="w-[110px] px-3 py-5">Próxima sessão</th>
            <th className="w-[78px] px-3 py-5 text-center">Encontros</th>
            <th className="w-[170px] px-3 py-5">Temas recorrentes</th>
            <th className="w-[86px] px-5 py-5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-lavender/60">
          {clients.map((client) => (
            <tr className="text-xs font-semibold text-tesText-secondary" key={client.id}>
              <td className="px-5 py-4">
                <ClientIdentity client={client} />
              </td>
              <td className="px-3 py-4">
                <StatusBadge status={client.status} />
              </td>
              <td className="px-3 py-4">
                <ChipList items={client.therapyLabels.slice(0, 2)} size="sm" />
              </td>
              <td className="px-3 py-4">{formatShortDateTime(client.lastSessionAt)}</td>
              <td className="px-3 py-4">{formatShortDateTime(client.nextSessionAt)}</td>
              <td className="px-3 py-4 text-center text-base font-extrabold text-brand-deep">
                {client.totalEncounters}
              </td>
              <td className="px-3 py-4">
                <ChipList items={client.topicLabels.slice(0, 2)} size="sm" />
              </td>
              <td className="px-5 py-4 text-right">
                <Link
                  aria-label={`Ver jornada de ${client.name}`}
                  className="inline-grid size-10 place-items-center rounded-xl border border-brand-lavender text-brand-primary hover:bg-brand-lavenderSoft"
                  href={client.timelineHref}
                >
                  <MoreVertical aria-hidden="true" size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JourneyMobileList({ clients }: { clients: JourneyHistoryClient[] }) {
  return (
    <div className="grid divide-y divide-brand-lavender/60 xl:hidden">
      {clients.map((client) => (
        <article className="grid gap-4 px-5 py-5" key={client.id}>
          <div className="flex items-start justify-between gap-4">
            <ClientIdentity client={client} />
            <StatusBadge status={client.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-tesText-secondary">
            <MiniFact label="Última" value={formatShortDateTime(client.lastSessionAt)} />
            <MiniFact label="Próxima" value={formatShortDateTime(client.nextSessionAt)} />
            <MiniFact label="Encontros" value={String(client.totalEncounters)} />
            <MiniFact label="Início" value={formatShortDateTime(client.firstSessionAt)} />
          </div>
          <div className="grid gap-2">
            <ChipList items={[...client.therapyLabels, ...client.topicLabels].slice(0, 4)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-brand-primary px-4 text-xs font-extrabold text-white"
              href={client.timelineHref}
            >
              Ver jornada
            </Link>
            <Link
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-brand-lavender px-4 text-xs font-extrabold text-brand-primary"
              href={client.sessionsHref}
            >
              Sessões
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function MetricCard({ metric }: { metric: JourneyHistoryMetric }) {
  const icons = {
    brand: <UsersRound aria-hidden="true" size={20} />,
    danger: <Clock4 aria-hidden="true" size={20} />,
    success: <Check aria-hidden="true" size={20} />,
    warning: <Sparkles aria-hidden="true" size={20} />,
  };
  const toneClasses = {
    brand: "bg-brand-lavenderSoft text-brand-primary",
    danger: "bg-status-dangerBg text-status-danger",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  };

  return (
    <article className="min-h-[190px] rounded-card border border-brand-lavender/60 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`grid size-12 shrink-0 place-items-center rounded-full ${toneClasses[metric.tone]}`}>
          {icons[metric.tone]}
        </span>
        <h2 className="text-xs font-extrabold leading-5 text-brand-primary">
          {metric.label}
        </h2>
      </div>
      <strong className="mt-7 block text-[34px] font-extrabold leading-none text-brand-deep">
        {metric.value}
      </strong>
      <p className="mt-2 text-xs font-semibold text-tesText-secondary">
        {metric.description}
      </p>
      {metric.trendLabel ? (
        <p className="mt-4 inline-flex rounded-full bg-brand-lavenderSoft px-3 py-1 text-[11px] font-extrabold text-brand-primary">
          {metric.trendLabel}
        </p>
      ) : null}
    </article>
  );
}

function PortfolioSummary({ summary }: { summary: JourneyHistorySummary }) {
  const items = [
    { color: "bg-status-success", label: "Ativos", value: summary.active },
    { color: "bg-status-warning", label: "Pausados", value: summary.paused },
    { color: "bg-status-danger", label: "Sem retorno recente", value: summary.stale },
  ];
  const activePercent = summary.total ? Math.round((summary.active / summary.total) * 100) : 0;
  const stalePercent = summary.total ? Math.round((summary.stale / summary.total) * 100) : 0;
  const chartStyle = {
    "--active": `${activePercent}%`,
    "--stale": `${activePercent + stalePercent}%`,
  } as CSSProperties;

  return (
    <SideCard title="Resumo da carteira">
      <div
        className="mx-auto grid size-36 place-items-center rounded-full bg-[conic-gradient(var(--tes-color-brand-mint)_0_var(--active),var(--tes-color-status-danger)_var(--active)_var(--stale),var(--tes-color-status-warning)_0)]"
        style={chartStyle}
      >
        <div className="grid size-24 place-items-center rounded-full bg-white text-center">
          <strong className="block text-2xl font-extrabold text-brand-deep">
            {summary.total}
          </strong>
          <span className="text-[11px] font-semibold text-tesText-secondary">
            clientes
          </span>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        {items.map((item) => (
          <div className="grid grid-cols-[16px_minmax(0,1fr)_64px] items-center gap-2 text-xs" key={item.label}>
            <span className={`size-2.5 rounded-full ${item.color}`} />
            <span className="font-extrabold text-[#4d2861]">{item.label}</span>
            <span className="text-right font-semibold text-tesText-secondary">
              {item.value} ({summary.total ? Math.round((item.value / summary.total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] font-semibold text-tesText-muted">
        {activePercent}% da carteira com atividade recente.
      </p>
    </SideCard>
  );
}

function SegmentsCard({ segments }: { segments: JourneyHistorySegment[] }) {
  return (
    <SideCard title="Segmentos">
      {segments.length > 0 ? (
        <div className="grid gap-3">
          {segments.map((segment) => (
            <div className="flex items-center justify-between gap-3" key={segment.id}>
              <SegmentBadge segment={segment} />
              <span className="grid size-7 place-items-center rounded-full bg-brand-lavenderSoft text-[11px] font-extrabold text-brand-primary">
                {segment.count}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-tesText-secondary">
          Nenhum segmento identificado ainda.
        </p>
      )}
    </SideCard>
  );
}

function RemindersCard({ reminders }: { reminders: JourneyHistoryReminder[] }) {
  return (
    <SideCard title="Lembretes">
      {reminders.length > 0 ? (
        <div className="grid gap-4">
          {reminders.map((reminder) => (
            <Link
              className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 rounded-xl border border-brand-lavender/70 p-3 transition hover:bg-brand-lavenderSoft"
              href={reminder.href}
              key={reminder.id}
            >
              <span className="grid size-9 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                <CalendarClock aria-hidden="true" size={16} />
              </span>
              <span>
                <strong className="block text-xs font-extrabold text-brand-deep">
                  {reminder.count} {reminder.label}
                </strong>
                <span className="mt-1 block text-[11px] font-semibold leading-4 text-tesText-secondary">
                  {reminder.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-tesText-secondary">
          Sem lembretes operacionais no momento.
        </p>
      )}
    </SideCard>
  );
}

function SideCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card">
      <h2 className="font-display text-2xl font-light italic text-brand-deep">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ClientIdentity({ client }: { client: JourneyHistoryClient }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <JourneyAvatar client={client} size={42} />
      <div className="min-w-0">
        <Link
          className="block truncate text-sm font-extrabold text-brand-deep hover:text-brand-primary"
          href={client.timelineHref}
        >
          {client.name}
        </Link>
        <p className="truncate text-[11px] font-semibold text-tesText-muted">
          {client.emailLabel}
        </p>
      </div>
    </div>
  );
}

function JourneyAvatar({
  client,
  size,
}: {
  client: JourneyHistoryClient;
  size: 42 | 64;
}) {
  const className =
    size === 64 ? "size-16 rounded-full object-cover" : "size-[42px] rounded-full object-cover";

  if (client.avatarUrl) {
    return (
      <Image
        alt=""
        className={className}
        height={size}
        src={client.avatarUrl}
        width={size}
      />
    );
  }

  return (
    <span
      className={`${className} grid place-items-center bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary`}
    >
      {client.name.slice(0, 1).toLocaleUpperCase("pt-BR")}
    </span>
  );
}

function StatusBadge({ status }: { status: JourneyClientStatus }) {
  const labels = {
    active: "Ativo",
    paused: "Pausado",
    stale: "Sem retorno",
  };
  const classes = {
    active: "bg-status-successBg text-status-success",
    paused: "bg-status-warningBg text-status-warning",
    stale: "bg-status-dangerBg text-status-danger",
  };

  return (
    <span className={`inline-flex min-h-6 items-center rounded-lg px-3 text-[10px] font-extrabold ${classes[status]}`}>
      {labels[status]}
    </span>
  );
}

function ChipList({
  items,
  size = "md",
}: {
  items: string[];
  size?: "md" | "sm";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <span
          className={`${size === "sm" ? "min-h-6 px-2 text-[9px]" : "min-h-7 px-3 text-[11px]"} inline-flex items-center rounded-lg bg-brand-lavenderSoft font-extrabold text-brand-primary`}
          key={`${item}-${index}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SegmentBadge({ segment }: { segment: JourneyHistorySegment }) {
  const classes = {
    brand: "bg-brand-lavenderSoft text-brand-primary",
    danger: "bg-status-dangerBg text-status-danger",
    info: "bg-status-infoBg text-status-info",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  };

  return (
    <span className={`inline-flex min-h-7 items-center rounded-lg px-3 text-[11px] font-extrabold ${classes[segment.tone]}`}>
      {segment.label}
    </span>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brand-lavenderSoft/50 p-3">
      <span className="block text-[10px] font-extrabold uppercase text-brand-primary">
        {label}
      </span>
      <strong className="mt-1 block text-xs text-brand-deep">{value}</strong>
    </div>
  );
}

function EmptyFilteredState() {
  return (
    <section className="p-8 text-center">
      <p className="text-sm font-extrabold text-brand-deep">
        Nenhum cliente encontrado com estes filtros.
      </p>
      <Link
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-lavender px-4 text-xs font-extrabold text-brand-primary"
        href={routes.therapist.patients}
      >
        Limpar filtros
      </Link>
    </section>
  );
}

export function parseJourneyHistoryFilters(
  searchParams: Record<string, string | string[] | undefined>,
): JourneyHistoryFilters {
  const status = first(searchParams.status);
  const sort = first(searchParams.sort);

  return {
    q: first(searchParams.q) ?? "",
    segment: first(searchParams.segment) ?? "",
    sort:
      sort === "name" || sort === "next_session" || sort === "sessions"
        ? sort
        : "last_session",
    status:
      status === "active" || status === "paused" || status === "stale"
        ? status
        : "all",
  };
}

export function filterJourneyClients(
  clients: JourneyHistoryClient[],
  filters: JourneyHistoryFilters,
) {
  const query = normalize(filters.q);
  const segment = normalize(filters.segment);
  const filtered = clients.filter((client) => {
    const matchesStatus =
      filters.status === "all" || client.status === filters.status;
    const matchesSegment =
      !segment ||
      client.topicLabels.some((topic) => normalize(topic) === segment);
    const matchesQuery =
      !query ||
      normalize(
        [
          client.name,
          client.emailLabel,
          ...client.therapyLabels,
          ...client.topicLabels,
        ].join(" "),
      ).includes(query);

    return matchesStatus && matchesSegment && matchesQuery;
  });

  return filtered.sort((a, b) => sortClients(a, b, filters.sort));
}

function sortClients(
  a: JourneyHistoryClient,
  b: JourneyHistoryClient,
  sort: JourneyHistoryFilters["sort"],
) {
  if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
  if (sort === "sessions") return b.totalEncounters - a.totalEncounters;
  if (sort === "next_session") {
    return dateValue(a.nextSessionAt, true) - dateValue(b.nextSessionAt, true);
  }

  return dateValue(b.lastSessionAt, false) - dateValue(a.lastSessionAt, false);
}

function buildJourneyCsvHref(clients: JourneyHistoryClient[]) {
  const header = [
    "cliente",
    "status",
    "terapias",
    "ultima_sessao",
    "proxima_sessao",
    "encontros",
    "temas",
  ];
  const rows = clients.map((client) => [
    client.name,
    client.status,
    client.therapyLabels.join(" | "),
    client.lastSessionAt ?? "",
    client.nextSessionAt ?? "",
    String(client.totalEncounters),
    client.topicLabels.join(" | "),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatShortDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  const dayMonth = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
  const hour = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${dayMonth.replace(".", "")} · ${hour}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function dateValue(value: string | null, missingLast: boolean) {
  if (!value) return missingLast ? Number.MAX_SAFE_INTEGER : 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return missingLast ? Number.MAX_SAFE_INTEGER : 0;
  return time;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
