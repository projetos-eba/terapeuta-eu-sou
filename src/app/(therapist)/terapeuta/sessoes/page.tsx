import Link from "next/link";
import type { Route } from "next";
import {
  CalendarClock,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleX,
  Clock,
  Clock4,
  Download,
  Filter,
  MoreVertical,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
  Wifi,
} from "lucide-react";

import {
  BookingStatus,
  type BookingStatus as BookingStatusValue,
} from "@/domain/tes";
import {
  BookingReference,
  formatSessionDateTime,
  formatSessionMoney,
  isSessionUpcoming,
  mapSessionPresentation,
  type SessionPresentation,
  type SessionReadModelItem,
  type TherapistSessionsCursor,
  type TherapistSessionsSummary,
} from "@/features/bookings";
import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page/app-page";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import {
  buildNextSessionsHref,
  getTherapistPendingConfirmationsSummary,
  getTherapistSessionsPage,
  parseTherapistSessionCursor,
  parseTherapistSessionFilters,
  type TherapistSessionCursorScope,
} from "@/features/therapist-sessions";
import { getSessionTimingBadge } from "@/features/therapist-sessions/session-timing-badge";
import { getTherapistSessionStatusBadge } from "@/features/therapist-sessions/session-status-badge";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

export default async function TherapistSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireTherapistSession(
    therapistRoutePolicies.sessions,
  );
  const rawSearchParams = await searchParams;
  const parsedFilters = parseTherapistSessionFilters(rawSearchParams);
  const searchQuery = getSearchQuery(rawSearchParams.q);

  if (!parsedFilters.valid) {
    return <SessionsErrorState message={parsedFilters.message} />;
  }

  const referenceDate = new Date();
  const now = referenceDate.toISOString();
  const pastCursorResult = parseTherapistSessionCursor(rawSearchParams, "past");
  const upcomingCursorResult = parseTherapistSessionCursor(
    rawSearchParams,
    "upcoming",
  );

  if (!pastCursorResult.valid) {
    return <SessionsErrorState message={pastCursorResult.message} />;
  }
  if (!upcomingCursorResult.valid) {
    return <SessionsErrorState message={upcomingCursorResult.message} />;
  }

  const legacyCursor = parsedFilters.filters.cursor;
  const pastCursor = pastCursorResult.cursor ?? legacyCursor;
  const upcomingCursor = upcomingCursorResult.cursor;
  const historyFilters = {
    ...parsedFilters.filters,
    cursor: pastCursor,
    periodEnd: now,
  };
  const upcomingFilters = {
    ...parsedFilters.filters,
    cursor: upcomingCursor,
    periodEnd: undefined,
    periodPreset: undefined,
    periodStart: now,
  };
  const [historyResult, upcomingResult, pendingConfirmationsResult] =
    await Promise.all([
      getTherapistSessionsPage({
        accessToken: session.accessToken,
        filters: historyFilters,
        profileId: session.profileId,
      }),
      getTherapistSessionsPage({
        accessToken: session.accessToken,
        filters: upcomingFilters,
        profileId: session.profileId,
      }),
      getTherapistPendingConfirmationsSummary({
        accessToken: session.accessToken,
        profileId: session.profileId,
      }),
    ]);
  const readError =
    historyResult.status === "error"
      ? historyResult
      : upcomingResult.status === "error"
        ? upcomingResult
        : null;
  const historyData =
    historyResult.status === "success" ? historyResult.data : null;
  const upcomingData =
    upcomingResult.status === "success" ? upcomingResult.data : null;
  const historyQueryItems = filterSessionsByQuery(
    historyData?.items ?? [],
    searchQuery,
  );
  const upcomingQueryItems = filterSessionsByQuery(
    upcomingData?.items ?? [],
    searchQuery,
  );
  const allItems = dedupeSessions([
    ...historyQueryItems,
    ...upcomingQueryItems,
  ]);
  const upcomingItems = allItems.filter((item) =>
    isSessionUpcoming(item, referenceDate),
  );
  const pastItems = allItems.filter(
    (item) => !isSessionUpcoming(item, referenceDate),
  );
  const metrics = historyData
    ? getSessionMetrics(historyData.items, historyData.summary)
    : null;
  const csvHref = allItems.length > 0 ? buildCsvDataHref(allItems) : "#";
  const hasActiveFilters = hasFilterState(parsedFilters.filters, searchQuery);
  const pendingConfirmationIds = new Set(
    pendingConfirmationsResult.status === "success"
      ? pendingConfirmationsResult.data.pendingBookingIds
      : [],
  );

  return (
    <AppPageContainer className="gap-6">
      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_320px]">
        <AppPageMain className="gap-6">
          <header className="flex items-start justify-between gap-4 pt-1 sm:pt-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
                Rotina de atendimento
              </p>
              <h1 className="mt-2 font-display text-[40px] font-light italic leading-[1.04] text-brand-deep sm:text-[52px]">
                Sessões
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-tesText-secondary sm:text-base">
                Acompanhe suas sessões, priorize o que pede atenção e mantenha a
                rotina organizada em um só lugar.
              </p>
            </div>
            <a
              aria-label="Exportar sessões"
              className="inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-lavender bg-white text-brand-primary shadow-card transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto sm:px-4"
              download="sessoes-tes.csv"
              href={csvHref}
            >
              <Download aria-hidden="true" size={18} />
              <span className="hidden text-sm font-extrabold sm:inline">
                Exportar
              </span>
            </a>
          </header>

          {readError ? (
            <SessionsErrorState
              correlationId={readError.error.correlationId}
              message={readError.error.message}
            />
          ) : (
            <>
              {metrics ? <SessionMetricsGrid metrics={metrics} /> : null}
              <section
                aria-label="Lista de sessões"
                className="grid min-w-0 gap-5"
              >
                <section
                  aria-label="Filtros de sessões"
                  className="min-w-0 overflow-hidden rounded-panel border border-brand-lavender/60 bg-white shadow-card"
                >
                  <SessionsFilterBar
                    bookingStatus={parsedFilters.filters.bookingStatus}
                    hasActiveFilters={hasActiveFilters}
                    itemCount={allItems.length}
                    periodPreset={parsedFilters.filters.periodPreset}
                    searchQuery={searchQuery}
                  />
                </section>
                <SessionGroup
                  description="Atendimentos futuros que seguem disponíveis para acontecer."
                  emptyMessage="Não há sessões futuras neste recorte."
                  items={upcomingItems}
                  nextHref={buildScopedNextSessionsHref(
                    upcomingFilters,
                    upcomingData?.page.nextCursor,
                    "upcoming",
                    searchQuery,
                    { past: pastCursor, upcoming: upcomingCursor },
                  )}
                  page={upcomingData?.page ?? null}
                  pendingConfirmationIds={pendingConfirmationIds}
                  title="Sessões que irão acontecer"
                />
                <SessionGroup
                  description="Sessões encerradas, canceladas ou com horário já ultrapassado."
                  emptyMessage="Não há sessões passadas neste recorte."
                  items={pastItems}
                  nextHref={buildScopedNextSessionsHref(
                    historyFilters,
                    historyData?.page.nextCursor,
                    "past",
                    searchQuery,
                    { past: pastCursor, upcoming: upcomingCursor },
                  )}
                  page={historyData?.page ?? null}
                  pendingConfirmationIds={pendingConfirmationIds}
                  title="Sessões que já passaram"
                  id="pending-confirmations"
                />
                <footer className="flex flex-col gap-2 rounded-card border border-brand-lavender/60 bg-surface-soft/60 px-5 py-5 text-xs font-semibold text-tesText-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Mostrando {allItems.length} sessão(ões) neste recorte.
                  </span>
                  <span>Os estados são atualizados conforme cada reserva.</span>
                </footer>
              </section>
            </>
          )}
        </AppPageMain>

        {allItems.length > 0 ? (
          <AppPageAside className="auto-rows-min self-start content-start !grid-cols-1 gap-5 lg:!grid-cols-2 xl:!block">
            <SessionsRightRail items={allItems} referenceDate={referenceDate} />
          </AppPageAside>
        ) : null}
      </AppPageGrid>
    </AppPageContainer>
  );
}

function SessionMetricsGrid({ metrics }: { metrics: SessionMetrics }) {
  return (
    <section
      aria-label="Indicadores de sessões"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 2xl:grid-cols-5"
    >
      <MetricCard
        description="na semana atual"
        icon={<CalendarDays aria-hidden="true" size={20} />}
        label="Sessões da semana"
        tone="brand"
        value={metrics.weekSessions}
      />
      <MetricCard
        description="com realização registrada"
        icon={<Check aria-hidden="true" size={20} />}
        label="Realizadas"
        tone="success"
        value={metrics.completed}
      />
      <MetricCard
        description="aguardando confirmação"
        icon={<Clock4 aria-hidden="true" size={20} />}
        label="Pendentes"
        tone="warning"
        value={metrics.pending}
      />
      <MetricCard
        description="sem reserva ativa"
        icon={<CircleX aria-hidden="true" size={20} />}
        label="Canceladas"
        tone="danger"
        value={metrics.cancelled}
      />
      <MetricCard
        description="no período selecionado"
        icon={<CheckCheck aria-hidden="true" size={20} />}
        label="Taxa de presença"
        tone="success"
        value={
          metrics.attendanceRate === null ? "—" : `${metrics.attendanceRate}%`
        }
      />
    </section>
  );
}

function MetricCard({
  description,
  icon,
  label,
  tone,
  value,
}: {
  description: string;
  icon: React.ReactNode;
  label: string;
  tone: "brand" | "danger" | "success" | "warning";
  value: number | string;
}) {
  const toneClasses = {
    brand: "bg-brand-lavenderSoft text-brand-primary",
    danger: "bg-status-dangerBg text-status-danger",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  };

  return (
    <article className="min-h-[172px] min-w-0 overflow-hidden rounded-card border border-brand-lavender/60 bg-white p-5 shadow-card">
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${toneClasses[tone]}`}
        >
          {icon}
        </span>
        <h2 className="min-w-0 text-sm font-extrabold leading-5 text-brand-primary">
          {label}
        </h2>
      </div>
      <p className="mt-7 text-[30px] font-extrabold leading-none text-brand-deep sm:text-[34px]">
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary">
        {description}
      </p>
    </article>
  );
}

function SessionsFilterBar({
  bookingStatus,
  hasActiveFilters,
  itemCount,
  periodPreset,
  searchQuery,
}: {
  bookingStatus?: BookingStatusValue;
  hasActiveFilters: boolean;
  itemCount: number;
  periodPreset?: string;
  searchQuery: string;
}) {
  return (
    <form
      action={routes.therapist.sessions}
      className="grid grid-cols-2 gap-3 border-b border-brand-lavender/60 p-4 sm:p-5 xl:grid-cols-[minmax(220px,1fr)_minmax(142px,0.58fr)_minmax(150px,0.62fr)_112px]"
    >
      <div className="col-span-2 flex items-center justify-between gap-3 xl:col-span-4">
        <div>
          <h2 className="text-base font-extrabold text-brand-deep">Sessões</h2>
          <p className="mt-1 text-xs font-semibold text-tesText-secondary">
            {itemCount}{" "}
            {itemCount === 1 ? "sessão carregada" : "sessões carregadas"}
          </p>
        </div>
        <Filter
          aria-hidden="true"
          className="shrink-0 text-brand-primary"
          size={20}
        />
      </div>
      <label className="relative col-span-2 block min-w-0 xl:col-span-1">
        <span className="sr-only">Buscar por pessoa ou terapia</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary"
          size={20}
        />
        <input
          className="min-h-12 w-full rounded-xl border border-brand-lavender/60 bg-white py-2 pl-4 pr-12 text-sm font-semibold text-brand-deep outline-none placeholder:text-tesText-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          defaultValue={searchQuery}
          maxLength={80}
          name="q"
          placeholder="Buscar por pessoa ou terapia..."
        />
      </label>
      <SelectField
        icon={<Filter aria-hidden="true" size={18} />}
        label="Status"
        name="status"
        options={bookingStatusOptions}
        value={bookingStatus}
      />
      <SelectField
        label="Período"
        name="period"
        options={periodOptions}
        value={periodPreset ?? "30"}
      />
      <div className="col-span-2 flex gap-2 xl:col-span-1">
        <button
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary xl:flex-none"
          type="submit"
        >
          Filtrar
        </button>
        {hasActiveFilters ? (
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={routes.therapist.sessions as Route}
          >
            Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function SelectField({
  icon,
  label,
  name,
  options,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  value?: string;
}) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary">
          {icon}
        </span>
      ) : null}
      <select
        className={`min-h-12 w-full appearance-none rounded-xl border border-brand-lavender/60 bg-white py-2 pr-10 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${
          icon ? "pl-10" : "pl-4"
        }`}
        defaultValue={value ?? ""}
        name={name}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary"
        size={17}
      />
    </label>
  );
}

function SessionsTable({
  items,
  pendingConfirmationIds,
}: {
  items: SessionReadModelItem[];
  pendingConfirmationIds: ReadonlySet<string>;
}) {
  return (
    <div className="hidden xl:block">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">
          Sessões carregadas para acompanhamento operacional
        </caption>
        <thead>
          <tr className="border-b border-brand-lavender/60 text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary">
            <th className="w-[25%] px-5 py-5">Pessoa</th>
            <th className="w-[19%] px-2.5 py-5">Terapia</th>
            <th className="w-[21%] px-2.5 py-5">Data e horário</th>
            <th className="w-[17%] px-2.5 py-5">Status</th>
            <th className="w-[11%] px-2.5 py-5 text-right">Valor</th>
            <th className="w-[7%] px-3 py-5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-lavender/50">
          {items.map((booking) => {
            const presentation = mapSessionPresentation(booking);
            const detailHref = routes.therapist.sessionDetail(
              booking.bookingId,
            ) as Route;

            return (
              <tr
                className="text-xs font-semibold text-tesText-secondary transition hover:bg-surface-soft/70"
                key={booking.bookingId}
              >
                <td className="px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <AvatarInitials name={booking.patientName} />
                    <span className="min-w-0">
                      <Link
                        className="block truncate text-sm font-extrabold text-brand-deep hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                        href={detailHref}
                      >
                        {booking.patientName}
                      </Link>
                      <BookingReference id={booking.bookingId} />
                      <SessionTimingBadge presentation={presentation} />
                    </span>
                  </div>
                </td>
                <td className="px-2.5 py-4">
                  <span className="block truncate font-extrabold text-brand-primary">
                    {booking.serviceTitle}
                  </span>
                  <span className="mt-1 inline-flex max-w-full rounded-full bg-brand-lavenderSoft px-2 py-1 text-[10px] font-bold text-brand-primary md:text-[11px]">
                    <span className="truncate">Online</span>
                  </span>
                </td>
                <td className="px-2.5 py-4 text-brand-deep">
                  {formatCompactSessionDateTime(
                    booking.startsAt,
                    booking.timezone,
                  )}
                </td>
                <td className="px-2.5 py-4">
                  <StatusBadge
                    confirmationPending={pendingConfirmationIds.has(
                      booking.bookingId,
                    )}
                    presentation={presentation}
                  />
                </td>
                <td className="px-2.5 py-4 text-right font-extrabold text-brand-deep">
                  {formatSessionMoney(booking.priceCents, booking.currency)}
                </td>
                <td className="px-3 py-4 text-right">
                  <Link
                    aria-label={`Abrir detalhes da sessão com ${booking.patientName}`}
                    className="inline-grid size-10 place-items-center rounded-xl border border-brand-lavender text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                    href={detailHref}
                  >
                    <MoreVertical aria-hidden="true" size={17} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SessionsMobileList({
  items,
  pendingConfirmationIds,
}: {
  items: SessionReadModelItem[];
  pendingConfirmationIds: ReadonlySet<string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:gap-4 sm:p-5 xl:hidden">
      {items.map((booking) => {
        const presentation = mapSessionPresentation(booking);
        return (
          <Link
            className="grid min-w-0 content-start gap-4 rounded-card border border-brand-lavender/60 bg-white p-4 shadow-card transition hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={routes.therapist.sessionDetail(booking.bookingId) as Route}
            key={booking.bookingId}
          >
            <span className="flex min-w-0 items-start gap-3">
              <AvatarInitials name={booking.patientName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-extrabold text-brand-deep">
                  {booking.patientName}
                </span>
                <BookingReference id={booking.bookingId} />
                <SessionTimingBadge presentation={presentation} />
                <span className="mt-1 block truncate text-sm font-semibold text-brand-primary">
                  {booking.serviceTitle}
                </span>
                <span className="mt-2 flex items-start gap-2 text-xs font-semibold leading-5 text-tesText-secondary">
                  <CalendarDays
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-brand-primary"
                    size={15}
                  />
                  {formatSessionDateTime(booking.startsAt, booking.timezone)}
                </span>
              </span>
              <StatusBadge
                confirmationPending={pendingConfirmationIds.has(
                  booking.bookingId,
                )}
                presentation={presentation}
              />
            </span>
            <span className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-tesText-secondary">
              <span>Atendimento online</span>
              <span className="font-extrabold text-brand-deep">
                {formatSessionMoney(booking.priceCents, booking.currency)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function SessionsRightRail({
  items,
  referenceDate,
}: {
  items: SessionReadModelItem[];
  referenceDate: Date;
}) {
  const nextSession = getNextSession(items, referenceDate);
  const nextSessionPresentation = nextSession
    ? mapSessionPresentation(nextSession, referenceDate)
    : null;

  return (
    <>
      <section className="h-auto self-start rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card xl:mb-5">
        <h2 className="font-display text-[28px] font-light italic leading-tight text-brand-deep">
          Próxima sessão
        </h2>
        {nextSession ? (
          <div className="mt-5 rounded-card bg-brand-lavenderSoft/45 p-4">
            <div className="flex items-start gap-3">
              <AvatarInitials name={nextSession.patientName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-brand-deep">
                  {nextSession.patientName}
                </p>
                <BookingReference id={nextSession.bookingId} />
                {nextSessionPresentation ? (
                  <SessionTimingBadge presentation={nextSessionPresentation} />
                ) : null}
                <p className="mt-1 truncate text-xs font-semibold text-brand-primary">
                  {nextSession.serviceTitle}
                </p>
              </div>
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-tesText-secondary">
              <CalendarDays
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-brand-primary"
                size={16}
              />
              {formatSessionDateTime(
                nextSession.startsAt,
                nextSession.timezone,
              )}
            </p>
            <div className="mt-4 grid gap-3">
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                href={
                  routes.therapist.sessionDetail(nextSession.bookingId) as Route
                }
              >
                <Video aria-hidden="true" size={16} />
                {nextSessionPresentation?.actions.primary.label ??
                  "Ver detalhes"}
              </Link>
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-brand-lavender text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
                href={routes.therapist.agenda as Route}
              >
                Ver agenda completa
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
            Nenhuma próxima sessão encontrada nos itens carregados.
          </p>
        )}
      </section>

      <section className="h-auto self-start rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card xl:mb-5">
        <h2 className="font-display text-[28px] font-light italic leading-tight text-brand-deep">
          Atalhos rápidos
        </h2>
        <div className="mt-4 grid gap-3">
          <RailLink
            description="Gerenciar horários"
            href={`${routes.therapist.agenda}?aba=horarios`}
            icon={<CalendarClock aria-hidden="true" size={18} />}
            label="Disponibilidade"
          />
          <RailLink
            description="Gerenciar abordagens"
            href={routes.therapist.services}
            icon={<Sparkles aria-hidden="true" size={18} />}
            label="Tipos de terapia"
          />
        </div>
      </section>

      <section className="h-auto self-start rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card xl:mb-5">
        <h2 className="font-display text-[28px] font-light italic leading-tight text-brand-deep">
          Antes da sessão
        </h2>
        <RailTip
          description="Verifique internet, câmera e microfone antes do encontro."
          icon={<Wifi aria-hidden="true" size={18} />}
          label="Teste sua conexão"
        />
        <RailTip
          description="Escolha um espaço reservado, confortável e silencioso."
          icon={<ShieldCheck aria-hidden="true" size={18} />}
          label="Ambiente tranquilo"
        />
        <RailTip
          description="Esteja pronto alguns minutos antes do início combinado."
          icon={<Clock aria-hidden="true" size={18} />}
          label="Seja pontual"
        />
      </section>

      <section className="h-auto self-start rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card xl:last:mb-0">
        <h2 className="font-display text-[28px] font-light italic leading-tight text-brand-deep">
          Política de reagendamento
        </h2>
        <ul className="mt-4 grid gap-4 text-xs font-semibold leading-5 text-tesText-secondary">
          <li className="flex gap-3">
            <CheckCheck
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-status-success"
              size={17}
            />
            O reagendamento deve ser feito com antecedência mínima registrada na
            política da sessão.
          </li>
          <li className="flex gap-3">
            <CheckCheck
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-status-success"
              size={17}
            />
            Cancelamentos e reembolsos seguem exclusivamente os estados
            financeiros confirmados.
          </li>
        </ul>
        <Link
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-brand-lavender text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
          href={routes.public.terms as Route}
        >
          Ver política completa
        </Link>
      </section>
    </>
  );
}

function RailLink({
  description,
  href,
  icon,
  label,
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      className="flex min-h-[68px] items-center gap-3 rounded-xl border border-brand-lavender/60 px-3 text-left transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
      href={href as Route}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-brand-primary">
          {label}
        </span>
        <span className="mt-1 block truncate text-[11px] font-semibold text-tesText-secondary">
          {description}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="shrink-0 text-brand-primary"
        size={16}
      />
    </Link>
  );
}

function RailTip({
  description,
  icon,
  label,
}: {
  description: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="mt-5 flex gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-brand-lavender text-brand-primary">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-extrabold text-brand-primary">
          {label}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-tesText-secondary">
          {description}
        </span>
      </span>
    </div>
  );
}

function SessionTimingBadge({
  presentation,
}: {
  presentation: SessionPresentation;
}) {
  const badge = getSessionTimingBadge(presentation);
  if (!badge) return null;

  const toneClasses = {
    info: "bg-brand-cyanSoft text-status-info",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  };

  return (
    <span
      className={`mt-1.5 inline-flex max-w-full items-center rounded-lg px-2 py-1 text-[10px] font-extrabold ${toneClasses[badge.tone]}`}
    >
      <span className="truncate">{badge.label}</span>
    </span>
  );
}

function StatusBadge({
  confirmationPending,
  presentation,
}: {
  confirmationPending?: boolean;
  presentation: SessionPresentation;
}) {
  const toneClasses = {
    danger: "bg-status-dangerBg text-status-danger",
    info: "bg-brand-lavenderSoft text-brand-primary",
    neutral: "bg-surface-soft text-tesText-secondary",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  };

  const { label, tone } = getTherapistSessionStatusBadge(
    presentation,
    confirmationPending,
  );

  return (
    <span
      className={`inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-extrabold sm:text-[11px] ${toneClasses[tone]}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary">
      {initials || "P"}
    </span>
  );
}

function SessionsErrorState({
  correlationId,
  message,
}: {
  correlationId?: string;
  message: string;
}) {
  return (
    <section
      className="mt-6 rounded-card border border-status-error/30 bg-white p-8 text-center shadow-card"
      role="alert"
    >
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Sessões temporariamente indisponíveis
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
      {correlationId ? (
        <p className="mt-2 text-xs font-semibold text-tesText-muted">
          Referência: {correlationId.slice(0, 8)}
        </p>
      ) : null}
    </section>
  );
}

type SessionMetrics = {
  attendanceRate: number | null;
  cancelled: number;
  completed: number;
  pending: number;
  weekSessions: number;
};

const bookingStatusOptions = [
  { label: "Confirmadas", value: BookingStatus.Confirmed },
  { label: "Pagamento pendente", value: BookingStatus.PendingPayment },
  { label: "Realizadas", value: BookingStatus.Completed },
  {
    label: "Canceladas pelo paciente",
    value: BookingStatus.CancelledByPatient,
  },
  {
    label: "Canceladas pelo terapeuta",
    value: BookingStatus.CancelledByTherapist,
  },
  { label: "Reembolsadas", value: BookingStatus.Refunded },
];

const periodOptions = [
  { label: "Últimos 7 dias", value: "7" },
  { label: "Últimos 30 dias", value: "30" },
  { label: "Últimos 60 dias", value: "60" },
  { label: "Últimos 90 dias", value: "90" },
  { label: "Histórico completo", value: "all" },
];

function SessionGroup({
  description,
  emptyMessage,
  items,
  nextHref,
  page,
  pendingConfirmationIds,
  title,
  id,
}: {
  description: string;
  emptyMessage: string;
  items: SessionReadModelItem[];
  nextHref: string | null;
  page: {
    hasMore: boolean;
    nextCursor: TherapistSessionsCursor | null;
  } | null;
  pendingConfirmationIds: ReadonlySet<string>;
  title: string;
  id?: string;
}) {
  return (
    <section
      aria-label={title}
      className="scroll-mt-24 min-w-0 overflow-hidden rounded-panel border border-brand-lavender/60 bg-white shadow-card"
      id={id}
    >
      <header className="border-b border-brand-lavender/40 px-4 py-5 sm:px-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-brand-deep">
              {title}
            </h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
              {description}
            </p>
          </div>
          <span
            aria-label={`${items.length} ${items.length === 1 ? "sessão" : "sessões"}`}
            className="shrink-0 rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary"
          >
            {items.length}
          </span>
        </div>
      </header>
      {items.length > 0 ? (
        <>
          <SessionsMobileList
            items={items}
            pendingConfirmationIds={pendingConfirmationIds}
          />
          <SessionsTable
            items={items}
            pendingConfirmationIds={pendingConfirmationIds}
          />
        </>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            {emptyMessage}
          </p>
        </div>
      )}
      {page?.hasMore && page.nextCursor && nextHref ? (
        <div className="flex justify-center border-t border-brand-lavender/40 px-4 py-4 sm:px-5">
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
            href={nextHref as Route}
          >
            Carregar mais
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function getSessionMetrics(
  items: SessionReadModelItem[],
  summary: TherapistSessionsSummary | null,
): SessionMetrics {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const completed =
    summary?.completed ?? items.filter(isCompletedSession).length;

  return {
    attendanceRate: summary?.attendanceRate ?? null,
    cancelled: summary?.cancelled ?? items.filter(isCancelledSession).length,
    completed,
    pending: summary?.pending ?? items.filter(isPendingSession).length,
    weekSessions: items.filter((item) => {
      const startsAt = new Date(item.startsAt);
      return startsAt >= weekStart && startsAt < weekEnd;
    }).length,
  };
}

function filterSessionsByQuery(
  items: SessionReadModelItem[],
  searchQuery: string,
) {
  const normalizedQuery = normalizeSearchText(searchQuery);
  if (!normalizedQuery) return items;

  return items.filter((item) => {
    const haystack = normalizeSearchText(
      `${item.patientName} ${item.serviceTitle}`,
    );
    return haystack.includes(normalizedQuery);
  });
}

function dedupeSessions(items: SessionReadModelItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.bookingId)) return false;
    seen.add(item.bookingId);
    return true;
  });
}

function getNextSession(items: SessionReadModelItem[], referenceDate: Date) {
  return [...items]
    .filter((item) => isSessionUpcoming(item, referenceDate))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];
}

function isCompletedSession(item: SessionReadModelItem) {
  const presentation = mapSessionPresentation(item);
  return presentation.state === "completed";
}

function isPendingSession(item: SessionReadModelItem) {
  const presentation = mapSessionPresentation(item);
  return (
    presentation.state === "payment_pending" ||
    presentation.state === "requires_attention" ||
    presentation.state === "reschedule_requested" ||
    presentation.state === "room_preparing"
  );
}

function isCancelledSession(item: SessionReadModelItem) {
  return (
    item.bookingStatus === BookingStatus.CancelledByPatient ||
    item.bookingStatus === BookingStatus.CancelledByTherapist ||
    item.bookingStatus === BookingStatus.NoShowPatient ||
    item.bookingStatus === BookingStatus.NoShowTherapist ||
    item.bookingStatus === BookingStatus.CancelledByPayment ||
    item.bookingStatus === BookingStatus.Refunded
  );
}

function buildCsvDataHref(items: SessionReadModelItem[]) {
  const rows = [
    ["Paciente", "Terapia", "Inicio", "Fim", "Status", "Valor", "Formato"],
    ...items.map((item) => [
      item.patientName,
      item.serviceTitle,
      formatSessionDateTime(item.startsAt, item.timezone),
      formatSessionDateTime(item.endsAt, item.timezone),
      mapSessionPresentation(item).label,
      formatSessionMoney(item.priceCents, item.currency),
      "Online",
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function formatCompactSessionDateTime(value: string, timezone: string) {
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
    weekday: "short",
  })
    .format(new Date(value))
    .replace(".", "");
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));

  return `${date} · ${time}`;
}

function getSearchQuery(value: string | string[] | undefined) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue ? firstValue.trim().slice(0, 80) : "";
}

function hasFilterState(
  filters: {
    bookingStatus?: string;
    periodPreset?: string;
  },
  searchQuery: string,
) {
  return Boolean(
    searchQuery ||
    filters.bookingStatus ||
    (filters.periodPreset && filters.periodPreset !== "30"),
  );
}

function withSearchQuery(href: string, searchQuery: string) {
  if (!searchQuery) return href;
  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("q", searchQuery);
  return `${pathname}?${params.toString()}`;
}

function buildScopedNextSessionsHref(
  filters: Parameters<typeof buildNextSessionsHref>[0],
  cursor: TherapistSessionsCursor | null | undefined,
  scope: TherapistSessionCursorScope,
  searchQuery: string,
  currentCursors: Partial<
    Record<TherapistSessionCursorScope, TherapistSessionsCursor | undefined>
  >,
) {
  if (!cursor) return null;

  const href = withSearchQuery(
    buildNextSessionsHref(filters, cursor, scope),
    searchQuery,
  );
  const otherScope = scope === "past" ? "upcoming" : "past";
  const otherCursor = currentCursors[otherScope];
  if (!otherCursor) return href;

  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  const otherPrefix = `${otherScope}Cursor`;
  params.set(`${otherPrefix}StartsAt`, otherCursor.startsAt);
  params.set(`${otherPrefix}BookingId`, otherCursor.bookingId);
  return `${pathname}?${params.toString()}`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + mondayOffset);
  return result;
}
