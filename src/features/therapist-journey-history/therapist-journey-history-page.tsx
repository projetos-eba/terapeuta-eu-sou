import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Clock4,
  Download,
  Filter,
  HeartHandshake,
  Info,
  MessageCircle,
  MoreVertical,
  NotebookText,
  Route,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page/app-page";
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
    <AppPageContainer className="gap-6">
      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_320px]">
        <AppPageMain className="gap-6">
          <header className="flex items-start justify-between gap-4 pt-1 sm:pt-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
                Histórico da jornada
              </p>
              <h1 className="mt-2 max-w-4xl font-display text-[38px] font-light italic leading-[1.04] text-brand-deep sm:text-[48px]">
                Pessoas que caminham com você
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-tesText-secondary sm:text-base">
                Acompanhe as sessões compartilhadas e identifique, com mais
                clareza, os próximos passos para dar continuidade ao cuidado.
              </p>
            </div>
            <a
              aria-label="Exportar histórico da jornada"
              className="inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-lavender bg-white text-brand-primary shadow-card transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto sm:px-4"
              download="historico-da-jornada-tes.csv"
              href={exportHref}
            >
              <Download aria-hidden="true" size={18} />
              <span className="hidden text-sm font-extrabold sm:inline">
                Exportar
              </span>
            </a>
          </header>

          <section
            aria-label="Indicadores das pessoas acompanhadas"
            className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
          >
            {data.metrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </section>

          <section className="min-w-0 overflow-hidden rounded-panel border border-brand-lavender/60 bg-white shadow-card">
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
                    pessoas
                  </span>
                  <span>Use os filtros para ajustar esta lista.</span>
                </footer>
              </>
            ) : (
              <EmptyFilteredState />
            )}
          </section>
        </AppPageMain>

        <AppPageAside className="auto-rows-min self-start content-start grid-cols-2 gap-5 md:grid-cols-2 xl:!block">
          <PortfolioSummary summary={data.summary} />
          <SegmentsCard segments={data.segments} />
          <RemindersCard reminders={data.reminders} />
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

export function TherapistJourneyDetailPage({
  data,
}: {
  data: JourneyHistoryDetailData;
}) {
  const { client, timeline } = data;

  return (
    <main className="mx-auto w-full max-w-[1210px] pb-10 text-tesText-primary">
      <Link
        className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-extrabold text-brand-primary hover:text-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.patients}
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Voltar para clientes
      </Link>

      <section className="relative overflow-hidden rounded-panel border border-brand-lavender/60 bg-gradient-to-r from-brand-lavenderSoft via-white to-brand-cyanSoft shadow-card">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 size-72 rounded-full border-[24px] border-white/60"
        />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-9">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span className="shrink-0 rounded-full border-4 border-white p-1 shadow-card">
              <JourneyAvatar client={client} size={64} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
                  Histórico da jornada
                </p>
                <StatusBadge status={client.status} />
              </div>
              <h1 className="mt-2 truncate font-display text-[38px] font-light italic leading-tight text-brand-deep sm:text-[52px]">
                {client.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
                Acompanhe as sessões compartilhadas, os temas identificados e os
                próximos passos operacionais desta jornada.
              </p>
              <div className="mt-4">
                <ChipList items={client.therapyLabels} />
              </div>
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2 lg:justify-end">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-lavender bg-white/90 px-4 text-sm font-extrabold text-brand-primary transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={client.sessionsHref}
            >
              <CalendarDays aria-hidden="true" size={17} />
              Ver sessões
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={routes.therapist.messages}
            >
              <MessageCircle aria-hidden="true" size={17} />
              Usar template
            </Link>
          </div>
        </div>
      </section>

      <JourneyDetailMetrics client={client} />
      <JourneyTopics client={client} />
      <JourneyMemory timeline={timeline} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CarePreferencesCard />
        <UpcomingEncounterCard client={client} />
      </div>
    </main>
  );
}

function JourneyDetailMetrics({ client }: { client: JourneyHistoryClient }) {
  const metrics = [
    {
      description: client.firstSessionAt
        ? `Desde ${formatDateOnly(client.firstSessionAt)}`
        : "Data de início não registrada",
      icon: <HeartHandshake aria-hidden="true" size={22} />,
      label: "Jornada iniciada há",
      tone: "bg-status-dangerBg text-status-danger",
      value: formatJourneyDuration(client.firstSessionAt),
    },
    {
      description:
        client.totalEncounters === 1
          ? "sessão registrada"
          : "sessões registradas",
      icon: <UsersRound aria-hidden="true" size={22} />,
      label: "Sessões compartilhadas",
      tone: "bg-brand-lavenderSoft text-brand-primary",
      value: String(client.totalEncounters),
    },
    {
      description: client.nextSessionAt
        ? formatSessionMeta(
            client.nextSessionAt,
            client.nextSessionServiceTitle,
          )
        : "Nenhuma sessão agendada",
      icon: <CalendarDays aria-hidden="true" size={22} />,
      label: "Próxima sessão",
      tone: "bg-status-successBg text-status-success",
      value: client.nextSessionAt
        ? formatCompactDate(client.nextSessionAt)
        : "-",
    },
    {
      description: client.lastSessionAt
        ? formatSessionMeta(
            client.lastSessionAt,
            client.lastSessionServiceTitle,
          )
        : "Ainda sem sessão registrada",
      icon: <Clock3 aria-hidden="true" size={22} />,
      label: "Última sessão",
      tone: "bg-brand-cyanSoft text-status-info",
      value: client.lastSessionAt
        ? formatCompactDate(client.lastSessionAt)
        : "-",
    },
  ];

  return (
    <section
      aria-label="Resumo da jornada"
      className="mt-6 grid overflow-hidden rounded-panel border border-brand-lavender/60 bg-white shadow-card sm:grid-cols-2 xl:grid-cols-4"
    >
      {metrics.map((metric, index) => (
        <article
          className={`flex min-h-40 gap-4 p-5 ${
            index === 1
              ? "border-t border-brand-lavender/60 sm:border-l sm:border-t-0 xl:border-l"
              : index === 2
                ? "border-t border-brand-lavender/60 xl:border-l xl:border-t-0"
                : index === 3
                  ? "border-t border-brand-lavender/60 sm:border-l xl:border-t-0"
                  : ""
          }`}
          key={metric.label}
        >
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-full ${metric.tone}`}
          >
            {metric.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold leading-5 text-tesText-secondary">
              {metric.label}
            </p>
            <strong className="mt-2 block text-[30px] font-extrabold leading-none text-brand-deep">
              {metric.value}
            </strong>
            <p className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary">
              {metric.description}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}

function JourneyTopics({ client }: { client: JourneyHistoryClient }) {
  const tones = [
    "bg-status-dangerBg text-status-danger",
    "bg-brand-lavenderSoft text-brand-primary",
    "bg-status-warningBg text-status-warning",
    "bg-status-successBg text-status-success",
    "bg-brand-cyanSoft text-status-info",
  ];

  return (
    <section className="mt-6 rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-primary">
            Visão da jornada
          </p>
          <h2 className="mt-2 font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[36px]">
            Temas identificados nos registros
          </h2>
        </div>
        <p className="max-w-xl text-sm font-semibold leading-6 text-tesText-secondary">
          Identificados a partir de títulos, terapias e resumos compartilhados.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {client.topicLabels.map((topic, index) => (
          <article
            className="flex min-h-28 items-center gap-3 rounded-card border border-brand-lavender/60 p-4"
            key={topic}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${tones[index % tones.length]}`}
            >
              <Sparkles aria-hidden="true" size={18} />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-tesText-muted">
                Tema
              </p>
              <h3 className="mt-1 text-sm font-extrabold text-brand-deep">
                {topic}
              </h3>
              <p className="mt-1 text-xs font-semibold text-tesText-secondary">
                Registrado na jornada
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function JourneyMemory({
  timeline,
}: {
  timeline: JourneyHistoryDetailData["timeline"];
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-panel border border-brand-lavender/60 bg-white shadow-card">
      <header className="border-b border-brand-lavender/60 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <NotebookText
              aria-hidden="true"
              className="mt-1 shrink-0 text-brand-primary"
              size={24}
            />
            <div>
              <h2 className="font-display text-[30px] font-light italic leading-tight text-brand-deep sm:text-[36px]">
                Memória das sessões
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
                Consulte os principais registros compartilhados em cada sessão e
                abra a sessão quando precisar de mais contexto.
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-9 w-fit items-center rounded-lg bg-brand-lavenderSoft px-3 text-xs font-extrabold text-brand-primary">
            {timeline.length} {timeline.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        <p className="mt-5 rounded-xl border border-brand-lavender/60 bg-brand-lavenderSoft/40 px-4 py-3 text-xs font-semibold leading-5 text-tesText-secondary">
          Esta memória reúne registros operacionais compartilhados e não
          substitui o prontuário clínico.
        </p>
      </header>

      {timeline.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[940px] table-fixed text-left">
              <thead>
                <tr className="border-b border-brand-lavender/60 text-[11px] font-extrabold uppercase tracking-[0.08em] text-tesText-muted">
                  <th className="w-[145px] px-5 py-4">Data e hora</th>
                  <th className="w-[150px] px-4 py-4">Terapia</th>
                  <th className="w-[170px] px-4 py-4">Temas identificados</th>
                  <th className="px-4 py-4">Registro compartilhado</th>
                  <th className="w-[130px] px-5 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-lavender/60">
                {timeline.map((item) => (
                  <tr className="align-top" key={item.id}>
                    <td className="px-5 py-5 text-sm font-extrabold text-brand-deep">
                      {formatDateTime(item.date)}
                    </td>
                    <td className="px-4 py-5 text-sm font-extrabold text-brand-deep">
                      {item.serviceTitle}
                    </td>
                    <td className="px-4 py-5">
                      <ChipList items={item.topicLabels} size="sm" />
                    </td>
                    <td className="px-4 py-5">
                      <strong className="block text-sm font-extrabold text-brand-deep">
                        {item.title}
                      </strong>
                      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                        {item.description}
                      </p>
                    </td>
                    <td className="px-5 py-5 text-right">
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-lavender px-3 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
                        href={item.href}
                      >
                        Abrir sessão
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-brand-lavender/60 xl:hidden">
            {timeline.map((item) => (
              <article className="grid gap-4 p-5" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-tesText-muted">
                      {formatDateTime(item.date)}
                    </p>
                    <h3 className="mt-2 text-base font-extrabold text-brand-deep">
                      {item.serviceTitle}
                    </h3>
                  </div>
                  <Link
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-brand-lavender px-3 text-sm font-extrabold text-brand-primary"
                    href={item.href}
                  >
                    Abrir
                  </Link>
                </div>
                <ChipList items={item.topicLabels} size="sm" />
                <div>
                  <strong className="text-sm font-extrabold text-brand-deep">
                    {item.title}
                  </strong>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="p-8 text-center">
          <NotebookText
            aria-hidden="true"
            className="mx-auto text-brand-primary"
            size={28}
          />
          <h3 className="mt-3 text-base font-extrabold text-brand-deep">
            Nenhuma sessão registrada ainda
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-tesText-secondary">
            Os registros compartilhados aparecerão aqui conforme as sessões
            forem concluídos.
          </p>
        </div>
      )}
    </section>
  );
}

function CarePreferencesCard() {
  return (
    <section className="rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <HeartHandshake
            aria-hidden="true"
            className="mt-1 shrink-0 text-brand-primary"
            size={24}
          />
          <div>
            <h2 className="font-display text-[29px] font-light italic leading-tight text-brand-deep">
              Como esta pessoa gosta de ser acolhida
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Preferências compartilhadas para orientar uma comunicação mais
              respeitosa entre as sessões.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/40 p-5">
        <UserRound
          aria-hidden="true"
          className="text-brand-primary"
          size={22}
        />
        <p className="mt-3 text-sm font-extrabold text-brand-deep">
          Nenhuma preferência compartilhada nesta área
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Use os canais apropriados para convidar a pessoa a compartilhar o que
          for relevante para a comunicação.
        </p>
      </div>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
        href={routes.therapist.messages}
      >
        <MessageCircle aria-hidden="true" size={17} />
        Usar template de comunicação
      </Link>
    </section>
  );
}

function UpcomingEncounterCard({ client }: { client: JourneyHistoryClient }) {
  return (
    <section className="rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <CalendarDays
            aria-hidden="true"
            className="mt-1 shrink-0 text-brand-primary"
            size={24}
          />
          <div>
            <h2 className="font-display text-[29px] font-light italic leading-tight text-brand-deep">
              Próxima sessão
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Acompanhe o próximo compromisso confirmado desta jornada.
            </p>
          </div>
        </div>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-brand-lavender px-3 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
          href={client.sessionsHref}
        >
          Ver sessões
        </Link>
      </div>
      {client.nextSessionAt ? (
        <div className="mt-6 grid gap-4 rounded-card border border-brand-lavender/60 bg-brand-lavenderSoft/40 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <span className="grid size-14 place-items-center rounded-xl bg-white text-center shadow-card">
            <span className="text-sm font-extrabold leading-4 text-brand-deep">
              {formatCompactDate(client.nextSessionAt)}
            </span>
          </span>
          <div>
            <p className="text-base font-extrabold text-brand-deep">
              {client.nextSessionServiceTitle ?? "Sessão TES"}
            </p>
            <p className="mt-1 text-sm font-semibold text-tesText-secondary">
              {formatDateTime(client.nextSessionAt)}
            </p>
            <span className="mt-3 inline-flex min-h-6 items-center rounded-lg bg-status-successBg px-3 text-xs font-extrabold text-status-success">
              Sessão confirmada
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/40 p-5">
          <p className="text-sm font-extrabold text-brand-deep">
            Nenhuma sessão agendada
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Quando houver uma sessão confirmada, ela aparecerá aqui.
          </p>
        </div>
      )}
    </section>
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
      className="grid grid-cols-2 gap-3 border-b border-brand-lavender/60 p-4 sm:p-5 xl:grid-cols-[minmax(220px,1fr)_minmax(132px,0.58fr)_minmax(150px,0.68fr)_minmax(146px,0.62fr)_112px]"
    >
      <div className="col-span-2 flex items-center justify-between gap-3 xl:col-span-5">
        <div>
          <h2 className="text-base font-extrabold text-brand-deep">
            Pessoas acompanhadas
          </h2>
          <p className="mt-1 text-xs font-semibold text-tesText-secondary">
            Busque, filtre e organize a sua jornada.
          </p>
        </div>
        <Filter
          aria-hidden="true"
          className="shrink-0 text-brand-primary"
          size={20}
        />
      </div>
      <label className="relative col-span-2 block min-w-0 xl:col-span-1">
        <span className="sr-only">Buscar por pessoa, terapia ou tema</span>
        <input
          className="h-12 w-full rounded-[18px] border border-brand-lavender/70 bg-white px-4 pr-11 text-sm font-semibold text-brand-deep shadow-card outline-none placeholder:text-tesText-muted focus:border-brand-primary focus:ring-4 focus:ring-brand-lavenderSoft"
          defaultValue={filters.q}
          name="q"
          placeholder="Buscar por pessoa, terapia ou tema..."
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
        <option value="all">Situação</option>
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
        <option value="sessions">Sessões</option>
      </SelectControl>
      <button className="col-span-2 inline-flex h-12 items-center justify-center rounded-[18px] bg-brand-primary px-4 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary xl:col-span-1">
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
    <label className="relative block min-w-0">
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
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary"
        size={15}
      />
    </label>
  );
}

function JourneyDesktopTable({ clients }: { clients: JourneyHistoryClient[] }) {
  return (
    <div className="hidden xl:block">
      <table className="w-full table-fixed text-left">
        <thead>
          <tr className="border-b border-brand-lavender/60 text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary">
            <th className="w-[23%] px-5 py-5">Pessoa</th>
            <th className="w-[10%] px-2.5 py-5">Situação</th>
            <th className="w-[15%] px-2.5 py-5">Terapias</th>
            <th className="w-[12%] px-2.5 py-5">Última sessão</th>
            <th className="w-[12%] px-2.5 py-5">Próxima sessão</th>
            <th className="w-[19%] px-2.5 py-5">Temas identificados</th>
            <th className="w-[9%] px-3 py-5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-lavender/60">
          {clients.map((client) => (
            <tr
              className="text-xs font-semibold text-tesText-secondary"
              key={client.id}
            >
              <td className="px-5 py-4">
                <ClientIdentity client={client} />
              </td>
              <td className="px-2.5 py-4">
                <StatusBadge status={client.status} />
              </td>
              <td className="px-2.5 py-4">
                <ChipList items={client.therapyLabels.slice(0, 2)} size="sm" />
              </td>
              <td className="px-2.5 py-4">
                {formatShortDateTime(client.lastSessionAt)}
              </td>
              <td className="px-2.5 py-4">
                {formatShortDateTime(client.nextSessionAt)}
              </td>
              <td className="px-2.5 py-4">
                <ChipList items={client.topicLabels.slice(0, 2)} size="sm" />
              </td>
              <td className="px-3 py-4 text-right">
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
    <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-5 xl:hidden">
      {clients.map((client) => (
        <article
          className="grid min-w-0 content-start gap-3 rounded-card border border-brand-lavender/60 bg-white p-3 shadow-card sm:p-4"
          key={client.id}
        >
          <div className="flex items-start justify-between gap-4">
            <ClientIdentity client={client} />
            <StatusBadge compact status={client.status} />
          </div>
          <div className="grid gap-2 text-xs font-semibold text-tesText-secondary">
            <MiniFact
              label="Última sessão"
              value={formatShortDateTime(client.lastSessionAt)}
            />
            <MiniFact
              label="Próximo"
              value={formatShortDateTime(client.nextSessionAt)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <ChipList items={client.therapyLabels.slice(0, 1)} size="sm" />
            <span className="text-xs font-extrabold text-brand-deep">
              {client.totalEncounters}{" "}
              {client.totalEncounters === 1 ? "sessão" : "sessões"}
            </span>
          </div>
          <div className="flex gap-2">
            <Link
              className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl bg-brand-primary px-3 text-sm font-extrabold text-white"
              href={client.timelineHref}
            >
              Ver jornada
            </Link>
            <Link
              aria-label={`Ver sessões de ${client.name}`}
              className="inline-grid size-11 shrink-0 place-items-center rounded-xl border border-brand-lavender text-brand-primary"
              href={client.sessionsHref}
            >
              <CalendarDays aria-hidden="true" size={18} />
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
    <article className="min-h-[190px] min-w-0 overflow-hidden rounded-card border border-brand-lavender/60 bg-white p-5 shadow-card">
      <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-2">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full ${toneClasses[metric.tone]}`}
        >
          {icons[metric.tone]}
        </span>
        <h2 className="min-w-0 break-words text-[14px] font-extrabold leading-4 tracking-[-0.01em] text-brand-primary">
          {metric.label}
        </h2>
      </div>
      <strong className="mt-7 block text-[30px] font-extrabold leading-none text-brand-deep sm:text-[34px]">
        {metric.value}
      </strong>
      <p className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary">
        {metric.description}
      </p>
      {metric.trendLabel ? (
        <p className="mt-4 inline-flex max-w-full break-words rounded-full bg-brand-lavenderSoft px-3 py-1 text-[11px] font-extrabold text-brand-primary">
          {metric.trendLabel}
        </p>
      ) : null}
    </article>
  );
}

function PortfolioSummary({ summary }: { summary: JourneyHistorySummary }) {
  const items = [
    {
      color: "bg-status-success",
      label: "Em acompanhamento",
      value: summary.active,
    },
    {
      color: "bg-status-danger",
      label: "Sem sessão recente",
      value: summary.stale,
    },
  ];
  const trackedTotal = summary.active + summary.stale;
  const activePercent = trackedTotal
    ? Math.round((summary.active / trackedTotal) * 100)
    : 0;
  const chartStyle = {
    "--active": `${activePercent}%`,
  } as CSSProperties;

  return (
    <SideCard
      className="col-span-2 xl:col-span-1"
      title="Resumo das pessoas acompanhadas"
    >
      <div
        className="mx-auto grid size-36 place-items-center rounded-full bg-[conic-gradient(var(--tes-color-brand-mint)_0_var(--active),var(--tes-color-status-danger)_var(--active)_100%)]"
        style={chartStyle}
      >
        <div className="grid size-24 place-items-center rounded-full bg-white text-center">
          <strong className="block text-2xl font-extrabold text-brand-deep">
            {trackedTotal}
          </strong>
          <span className="text-[11px] font-semibold text-tesText-secondary">
            pessoas
          </span>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        {items.map((item) => (
          <div
            className="grid grid-cols-[16px_minmax(0,1fr)_64px] items-center gap-2 text-xs"
            key={item.label}
          >
            <span className={`size-2.5 rounded-full ${item.color}`} />
            <span className="flex min-w-0 items-center gap-1 font-extrabold text-[#4d2861]">
              <span className="min-w-0">{item.label}</span>
              {item.label === "Sem sessão recente" ? (
                <span className="group relative inline-flex shrink-0">
                  <button
                    aria-label="Sobre sem sessão recente"
                    aria-describedby="stale-session-tooltip"
                    className="inline-flex size-5 items-center justify-center rounded-full text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                    title="Sem sessão registrada nos últimos 30 dias."
                    type="button"
                  >
                    <Info aria-hidden="true" size={14} />
                  </button>
                  <span
                    className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-2 w-56 max-w-[calc(100vw-2rem)] translate-x-0 rounded-lg bg-brand-deep px-3 py-2 text-left text-xs font-semibold leading-5 text-white opacity-0 shadow-float transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                    id="stale-session-tooltip"
                    role="tooltip"
                  >
                    Sem sessão registrada nos últimos 30 dias. Este sinal ajuda
                    a lembrar de revisar a continuidade da jornada com cuidado.
                  </span>
                </span>
              ) : null}
            </span>
            <span className="text-right font-semibold text-tesText-secondary">
              {item.value} (
              {trackedTotal ? Math.round((item.value / trackedTotal) * 100) : 0}
              %)
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] font-semibold text-tesText-muted">
        {activePercent}% das pessoas tiveram uma sessão nos últimos 30 dias.
      </p>
    </SideCard>
  );
}

function SegmentsCard({ segments }: { segments: JourneyHistorySegment[] }) {
  return (
    <SideCard title="Temas recorrentes">
      {segments.length > 0 ? (
        <div className="grid gap-3">
          {segments.map((segment) => (
            <div
              className="flex items-center justify-between gap-3"
              key={segment.id}
            >
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
    <SideCard className="col-span-2 xl:col-span-1" title="Lembretes">
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
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section
      className={`h-auto self-start rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card xl:mb-5 xl:last:mb-0 ${className ?? ""}`}
    >
      <h2 className="font-display text-[28px] font-light italic leading-tight text-brand-deep">
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
          Jornada acompanhada
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
    size === 64
      ? "size-16 rounded-full object-cover"
      : "size-[42px] rounded-full object-cover";

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

function StatusBadge({
  compact = false,
  status,
}: {
  compact?: boolean;
  status: JourneyClientStatus;
}) {
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
    <span
      className={`inline-flex min-h-6 items-center rounded-lg ${compact ? "px-2" : "px-3"} text-[10px] font-extrabold ${classes[status]}`}
    >
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
          className={`${size === "sm" ? "min-h-6 px-2 text-[10px] md:text-[11px]" : "min-h-7 px-3 text-[11px]"} inline-flex items-center rounded-lg bg-brand-lavenderSoft font-extrabold text-brand-primary`}
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
    <span
      className={`inline-flex min-h-7 items-center rounded-lg px-3 text-[11px] font-extrabold ${classes[segment.tone]}`}
    >
      {segment.label}
    </span>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brand-lavenderSoft/50 p-2.5 sm:p-3">
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
    "sessoes",
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

function formatJourneyDuration(value: string | null) {
  if (!value) return "-";
  const startedAt = new Date(value);
  if (!Number.isFinite(startedAt.getTime())) return "-";

  const now = new Date();
  const monthDifference = Math.max(
    0,
    (now.getFullYear() - startedAt.getFullYear()) * 12 +
      now.getMonth() -
      startedAt.getMonth(),
  );
  if (monthDifference >= 12) {
    const years = Math.floor(monthDifference / 12);
    return `${years} ${years === 1 ? "ano" : "anos"}`;
  }
  if (monthDifference >= 1) {
    return `${monthDifference} ${monthDifference === 1 ? "mês" : "meses"}`;
  }

  const days = Math.max(
    0,
    Math.floor((now.getTime() - startedAt.getTime()) / 86_400_000),
  );
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function formatCompactDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(date);
}

function formatSessionMeta(value: string, serviceTitle: string | null) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return serviceTitle ?? "Sessão TES";

  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${time} · ${serviceTitle ?? "Sessão TES"}`;
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
