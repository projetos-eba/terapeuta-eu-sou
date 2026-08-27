"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  Construction,
  CreditCard,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { mapSessionPresentation } from "@/features/bookings";
import { TESDialog } from "@/components/tes/tes-dialog";
import {
  SessionFinancialStatus,
  type TherapistScheduleRule,
} from "@/domain/tes";
import { routes } from "@/lib/routes";

import { TherapistAgendaHeader } from "./therapist-agenda-chrome";

import type {
  TherapyCalendarColorKey,
  TherapistCalendarAttentionItem,
  TherapistCalendarBlock,
  TherapistCalendarBooking,
  TherapistCalendarDemandItem,
  TherapistCalendarHold,
  TherapistCalendarReadModel,
  TherapistCalendarView,
} from "../therapist-calendar.types";

const dayLabels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const weekDayLabels = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const hourBlocks = [8, 10, 12, 14, 16, 18, 20];
const hourHeight = 66;
const defaultTimelineRange = { endHour: 22, startHour: 8 };
const closedBookingPattern = {
  backgroundColor: "var(--tes-color-surface-mist)",
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--tes-color-surface-default) 0 8px, var(--tes-color-brand-lavender-soft) 8px 16px)",
};

type CalendarStatusFilter = "all" | "paid" | "pending_payment" | "reschedule";

type CalendarFiltersState = {
  query: string;
  serviceId: string;
  status: CalendarStatusFilter;
};

const colorStyles: Record<
  TherapyCalendarColorKey,
  { badge: string; border: string; surface: string; text: string }
> = {
  blue: {
    badge: "bg-[#1f70c1]",
    border: "border-[#cbdcf4]",
    surface: "bg-[#e9f2fd]",
    text: "text-[#14559a]",
  },
  green: {
    badge: "bg-[#16883a]",
    border: "border-[#cfe9d5]",
    surface: "bg-[#e5f5df]",
    text: "text-[#126c31]",
  },
  neutral: {
    badge: "bg-[#77738d]",
    border: "border-[#dedce8]",
    surface: "bg-[#f1f0f4]",
    text: "text-[#555267]",
  },
  orange: {
    badge: "bg-[#f07818]",
    border: "border-[#f4dfc5]",
    surface: "bg-[#fff0dd]",
    text: "text-[#b74c00]",
  },
  pink: {
    badge: "bg-[#e82466]",
    border: "border-[#f4cddd]",
    surface: "bg-[#ffe4ef]",
    text: "text-[#bd174e]",
  },
  purple: {
    badge: "bg-brand-primary",
    border: "border-brand-lavender",
    surface: "bg-[#f2e9ff]",
    text: "text-[#4c1598]",
  },
};

export function TherapistCalendar({
  data,
  scheduleRules = null,
}: {
  data: TherapistCalendarReadModel;
  scheduleRules?: TherapistScheduleRule[] | null;
}) {
  const router = useRouter();
  const [selectedBooking, setSelectedBooking] =
    useState<TherapistCalendarBooking | null>(null);
  const [filters, setFilters] = useState<CalendarFiltersState>({
    query: "",
    serviceId: "all",
    status: "all",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia?.("(min-width: 768px)");

    if (!desktopQuery) {
      setFiltersOpen(true);
      return;
    }

    const syncFiltersVisibility = () => setFiltersOpen(desktopQuery.matches);
    syncFiltersVisibility();
    desktopQuery.addEventListener("change", syncFiltersVisibility);

    return () =>
      desktopQuery.removeEventListener("change", syncFiltersVisibility);
  }, []);
  const days = useMemo(
    () => dateKeysBetween(data.range.localStart, data.range.localEndExclusive),
    [data.range.localEndExclusive, data.range.localStart],
  );
  const todayKey = dateKeyForInstant(new Date().toISOString(), data.timezone);
  const filteredBookings = useMemo(
    () =>
      data.bookings.filter((booking) =>
        matchesBookingFilters(booking, filters),
      ),
    [data.bookings, filters],
  );
  const filteredHolds = useMemo(
    () => data.holds.filter((hold) => matchesHoldFilters(hold, filters)),
    [data.holds, filters],
  );
  const filteredBlocks = useMemo(
    () => data.blocks.filter((block) => matchesBlockFilters(block, filters)),
    [data.blocks, filters],
  );
  const todayBookings = filteredBookings.filter(
    (booking) =>
      dateKeyForInstant(booking.startsAt, data.timezone) === todayKey,
  );
  const periodLabel = formatPeriodLabel(data);
  const step = data.view === "day" ? 1 : data.view === "week" ? 7 : 42;
  const previousDate = addDays(data.anchorDate, -step);
  const nextDate = addDays(data.anchorDate, step);

  return (
    <main className="mx-auto w-full max-w-[1210px] pb-14 text-tesText-primary">
      <TherapistAgendaHeader
        activeTab="calendario"
        actions={
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-deep transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={`${routes.therapist.agenda}?aba=bloqueios` as Route}
            >
              <Construction aria-hidden="true" size={18} />
              Bloquear horário
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={`${routes.therapist.agenda}?aba=horarios` as Route}
            >
              <Plus aria-hidden="true" size={18} />
              Adicionar horários
            </Link>
          </div>
        }
      />

      <section
        aria-label="Controles do calendário"
        className="mt-5 flex flex-col gap-4 rounded-xl bg-surface-soft/70 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-brand-lavender/70">
          {(["day", "week", "month"] as const).map((view) => (
            <Link
              aria-current={data.view === view ? "page" : undefined}
              className={`inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary ${
                data.view === view
                  ? "bg-brand-primary text-white"
                  : "text-brand-deep hover:bg-brand-lavenderSoft"
              }`}
              href={calendarHref(view, data.anchorDate)}
              key={view}
            >
              {view === "day" ? "Dia" : view === "week" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              aria-label="Período anterior"
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-brand-lavender bg-white text-brand-primary transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
              href={calendarHref(data.view, previousDate)}
            >
              <ChevronLeft aria-hidden="true" size={20} />
            </Link>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Escolher data da agenda</span>
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-brand-primary"
                size={18}
              />
              <span className="pointer-events-none flex min-h-11 min-w-[220px] items-center rounded-lg border border-brand-lavender bg-white py-2 pl-11 pr-10 text-sm font-extrabold text-brand-deep sm:min-w-[270px]">
                {periodLabel}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-brand-primary"
                size={18}
              />
              <input
                className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onChange={(event) => {
                  if (isDateKey(event.target.value)) {
                    router.push(calendarHref(data.view, event.target.value));
                  }
                }}
                type="date"
                value={data.anchorDate}
              />
            </label>
            <Link
              aria-label="Próximo período"
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-brand-lavender bg-white text-brand-primary transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
              href={calendarHref(data.view, nextDate)}
            >
              <ChevronRight aria-hidden="true" size={20} />
            </Link>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
            href={calendarHref(data.view, todayKey)}
          >
            Hoje
          </Link>
        </div>
      </section>

      <CalendarFilters
        filters={filters}
        isOpen={filtersOpen}
        onChange={setFilters}
        onOpenChange={setFiltersOpen}
        resultCount={filteredBookings.length}
        services={data.services}
        totalCount={data.bookings.length}
      />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <MobileChronologicalList
            blocks={filteredBlocks}
            bookings={filteredBookings}
            holds={filteredHolds}
            onSelect={setSelectedBooking}
            timezone={data.timezone}
          />

          <div className="hidden md:block">
            {data.view === "month" ? (
              <MonthCalendar
                bookings={filteredBookings}
                days={days}
                onSelect={setSelectedBooking}
                timezone={data.timezone}
                todayKey={todayKey}
              />
            ) : (
              <TimelineCalendar
                blocks={filteredBlocks}
                bookings={filteredBookings}
                days={days}
                holds={filteredHolds}
                onSelect={setSelectedBooking}
                scheduleRules={scheduleRules}
                timezone={data.timezone}
                todayKey={todayKey}
              />
            )}
          </div>

          <CalendarLegend services={data.services} />
        </div>

        <aside
          aria-label="Contexto da agenda"
          className="grid gap-5 md:grid-cols-2 xl:block xl:rounded-[14px] xl:border xl:border-brand-lavender/60 xl:bg-white xl:px-5"
        >
          <TodayCard
            bookings={todayBookings}
            onSelect={setSelectedBooking}
            timezone={data.timezone}
          />
          <AttentionCard items={data.attentionItems} timezone={data.timezone} />
          <DemandCard demand={data.demand} />
        </aside>
      </div>

      <TesScheduleTip demand={data.demand} />

      {selectedBooking ? (
        <BookingDialog
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          timezone={data.timezone}
        />
      ) : null}
    </main>
  );
}

function CalendarFilters({
  filters,
  isOpen,
  onChange,
  onOpenChange,
  resultCount,
  services,
  totalCount,
}: {
  filters: CalendarFiltersState;
  isOpen: boolean;
  onChange: (filters: CalendarFiltersState) => void;
  onOpenChange: (isOpen: boolean) => void;
  resultCount: number;
  services: TherapistCalendarReadModel["services"];
  totalCount: number;
}) {
  const hasFilters =
    filters.query.trim() !== "" ||
    filters.serviceId !== "all" ||
    filters.status !== "all";
  const activeFilterCount = [
    filters.query.trim() !== "",
    filters.serviceId !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

  return (
    <section
      aria-label="Filtros do calendário"
      className="mt-3 border-y border-brand-lavender/50 bg-white"
    >
      <button
        aria-controls="calendar-filter-panel"
        aria-expanded={isOpen}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-extrabold text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:px-5"
        onClick={() => onOpenChange(!isOpen)}
        type="button"
      >
        <span className="flex items-center gap-2">
          Filtrar agenda
          {activeFilterCount ? (
            <span className="grid min-w-6 place-items-center rounded-full bg-brand-lavenderSoft px-1.5 py-0.5 text-[10px] font-extrabold text-brand-primary md:text-[11px]">
              {activeFilterCount}
              <span className="sr-only"> filtro(s) ativo(s)</span>
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-tesText-muted md:text-[11px]">
            {resultCount} de {totalCount}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 text-brand-primary transition ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      <div
        className={`${isOpen ? "flex" : "hidden"} flex-col gap-3 border-t border-brand-lavender/60 p-4 sm:p-5 lg:flex-row lg:items-end`}
        hidden={!isOpen}
        id="calendar-filter-panel"
      >
        <label className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase text-tesText-muted md:text-[11px]">
            <Search aria-hidden="true" size={14} />
            Buscar
          </span>
          <input
            className="min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none placeholder:text-tesText-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            onChange={(event) =>
              onChange({ ...filters, query: event.target.value })
            }
            placeholder="Paciente ou terapia"
            type="search"
            value={filters.query}
          />
        </label>

        <label className="min-w-0 lg:w-[220px]">
          <span className="mb-1 block text-[10px] font-extrabold uppercase text-tesText-muted md:text-[11px]">
            Terapia
          </span>
          <select
            className="min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            onChange={(event) =>
              onChange({ ...filters, serviceId: event.target.value })
            }
            value={filters.serviceId}
          >
            <option value="all">Todas</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 lg:w-[230px]">
          <span className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase text-tesText-muted md:text-[11px]">
            <SlidersHorizontal aria-hidden="true" size={14} />
            Estado
          </span>
          <select
            className="min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            onChange={(event) =>
              onChange({
                ...filters,
                status: event.target.value as CalendarStatusFilter,
              })
            }
            value={filters.status}
          >
            <option value="all">Todos</option>
            <option value="paid">Pagas</option>
            <option value="pending_payment">Aguardando pagamento</option>
            <option value="reschedule">Com reagendamento</option>
          </select>
        </label>

        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!hasFilters}
          onClick={() =>
            onChange({ query: "", serviceId: "all", status: "all" })
          }
          type="button"
        >
          <X aria-hidden="true" size={15} />
          Limpar
        </button>
        <p
          aria-live="polite"
          className="text-[11px] font-bold text-tesText-secondary lg:pb-3"
        >
          {resultCount} de {totalCount} sessão(ões) nesta visualização.
        </p>
      </div>
    </section>
  );
}

function TimelineCalendar({
  blocks,
  bookings,
  days,
  holds,
  onSelect,
  scheduleRules,
  timezone,
  todayKey,
}: {
  blocks: TherapistCalendarBlock[];
  bookings: TherapistCalendarBooking[];
  days: string[];
  holds: TherapistCalendarHold[];
  onSelect: (booking: TherapistCalendarBooking) => void;
  scheduleRules: TherapistScheduleRule[] | null;
  timezone: string;
  todayKey: string;
}) {
  const timelineRange = timelineRangeForCalendar({
    blocks,
    bookings,
    days,
    holds,
    scheduleRules,
    timezone,
  });
  const gridHeight =
    (timelineRange.endHour - timelineRange.startHour) * hourHeight;
  const widthClass =
    days.length === 1 ? "min-w-[360px]" : "min-w-[760px] xl:min-w-0";
  const [currentInstant, setCurrentInstant] = useState<string | null>(null);

  useEffect(() => {
    const updateCurrentInstant = () =>
      setCurrentInstant(new Date().toISOString());
    updateCurrentInstant();
    const timer = window.setInterval(updateCurrentInstant, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentDayKey = currentInstant
    ? dateKeyForInstant(currentInstant, timezone)
    : null;
  const currentMinutes = currentInstant
    ? timeMinutes(currentInstant, timezone)
    : null;
  const currentTimeTop =
    currentMinutes !== null &&
    currentMinutes >= timelineRange.startHour * 60 &&
    currentMinutes <= timelineRange.endHour * 60
      ? ((currentMinutes - timelineRange.startHour * 60) / 60) * hourHeight
      : null;

  return (
    <section
      aria-label="Agenda por horário"
      className="overflow-hidden rounded-[14px] border border-brand-lavender/70 bg-white"
    >
      <div className="overflow-x-auto">
        <div className={widthClass}>
          <div
            className="grid"
            style={{ gridTemplateColumns: `72px repeat(${days.length}, 1fr)` }}
          >
            <span aria-hidden="true" />
            {days.map((day) => {
              const current = day === todayKey;
              return (
                <div className="pb-4 pt-5 text-center" key={day}>
                  <span className="block text-[10px] font-extrabold text-tesText-muted md:text-[11px]">
                    {dayLabels[dayOfWeek(day)]}
                  </span>
                  <span
                    className={`mx-auto mt-1 grid size-9 place-items-center rounded-full text-lg font-extrabold ${
                      current
                        ? "bg-brand-primary text-white"
                        : "text-brand-deep"
                    }`}
                  >
                    {Number(day.slice(-2))}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `72px repeat(${days.length}, 1fr)`,
              height: gridHeight,
            }}
          >
            <div className="relative border-r border-brand-lavender/70">
              {Array.from(
                { length: timelineRange.endHour - timelineRange.startHour + 1 },
                (_, index) => timelineRange.startHour + index,
              ).map((hour) => (
                <span
                  className="absolute right-4 -translate-y-1/2 text-[10px] font-bold text-tesText-muted md:text-[11px]"
                  key={hour}
                  style={{ top: (hour - timelineRange.startHour) * hourHeight }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            {days.map((day, index) => (
              <div
                className="relative border-r border-brand-lavender/60 last:border-r-0"
                key={day}
                style={{ gridColumn: index + 2 }}
              >
                {day === todayKey &&
                day === currentDayKey &&
                currentTimeTop !== null ? (
                  <span
                    aria-label="Horário atual"
                    className="pointer-events-none absolute inset-x-0 z-[8] border-t border-brand-primary"
                    role="img"
                    style={{ top: currentTimeTop }}
                  >
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-brand-primary" />
                    <span className="absolute left-2 top-1 rounded bg-white/95 px-1 py-0.5 text-[11px] font-extrabold leading-none text-brand-primary">
                      Agora
                    </span>
                  </span>
                ) : null}
                {Array.from(
                  {
                    length: timelineRange.endHour - timelineRange.startHour + 1,
                  },
                  (_, hourIndex) =>
                    hourIndex === 0 ? null : (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 border-t border-brand-lavender/55"
                        key={hourIndex}
                        style={{ top: hourIndex * hourHeight }}
                      />
                    ),
                )}
                {blocks
                  .filter(
                    (block) =>
                      dateKeyForInstant(block.startsAt, timezone) === day,
                  )
                  .map((block) => (
                    <TimelineBlock
                      block={block}
                      key={block.id}
                      timelineRange={timelineRange}
                      timezone={timezone}
                    />
                  ))}
                {holds
                  .filter(
                    (hold) =>
                      dateKeyForInstant(hold.startsAt, timezone) === day,
                  )
                  .map((hold) => (
                    <TimelineHold
                      hold={hold}
                      key={hold.id}
                      timelineRange={timelineRange}
                      timezone={timezone}
                    />
                  ))}
                {bookings
                  .filter(
                    (booking) =>
                      dateKeyForInstant(booking.startsAt, timezone) === day,
                  )
                  .map((booking) => (
                    <TimelineBooking
                      booking={booking}
                      key={booking.bookingId}
                      onSelect={onSelect}
                      timelineRange={timelineRange}
                      timezone={timezone}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {scheduleRules === null ? (
        <p
          className="border-t border-brand-lavender/60 px-4 py-3 text-center text-sm font-semibold text-tesText-secondary"
          role="status"
        >
          A agenda mostra as sessões registradas enquanto seus horários são
          carregados.
        </p>
      ) : null}
      <p className="border-t border-brand-lavender/60 px-4 py-3 text-center text-sm font-semibold text-tesText-secondary">
        Clique em um horário para ver ou editar o agendamento.
      </p>
    </section>
  );
}

function TimelineBooking({
  booking,
  onSelect,
  timelineRange,
  timezone,
}: {
  booking: TherapistCalendarBooking;
  onSelect: (booking: TherapistCalendarBooking) => void;
  timelineRange: TimelineRange;
  timezone: string;
}) {
  const placement = timelinePlacement(
    booking.startsAt,
    booking.endsAt,
    timelineRange,
    timezone,
  );
  if (!placement) return null;
  const style = colorStyles[booking.colorKey];
  const status = mapSessionPresentation(booking);
  const isClosed = isClosedCalendarBooking(status.state, booking.financialStatus);

  return (
    <button
      aria-label={`${booking.serviceTitle} com ${booking.patientName}, ${formatTimeRange(booking.startsAt, booking.endsAt, timezone)}, ${status.label}`}
      className={`absolute inset-x-2 z-10 overflow-hidden rounded-md border px-2.5 py-2 text-left shadow-sm transition hover:z-20 hover:brightness-[0.98] focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-primary ${isClosed ? "border-tesText-muted" : `${style.border} ${style.surface}`}`}
      data-session-state={status.state}
      onClick={() => onSelect(booking)}
      style={{
        ...(isClosed ? closedBookingPattern : {}),
        height: placement.height,
        top: placement.top,
      }}
      type="button"
    >
      <span
        className={`block text-[11px] font-extrabold leading-none ${isClosed ? "text-tesText-secondary" : style.text}`}
      >
        {formatTime(booking.startsAt, timezone)}
      </span>
      <span className="mt-1.5 block truncate text-sm font-extrabold leading-tight text-brand-deep">
        {booking.serviceTitle}
      </span>
      <span className="mt-1 block truncate text-[10px] font-bold leading-tight text-tesText-secondary md:text-[11px]">
        {isClosed ? status.label : booking.patientName}
      </span>
    </button>
  );
}

function TimelineBlock({
  block,
  timelineRange,
  timezone,
}: {
  block: TherapistCalendarBlock;
  timelineRange: TimelineRange;
  timezone: string;
}) {
  const placement = block.allDay
    ? { height: 32, top: 2 }
    : timelinePlacement(block.startsAt, block.endsAt, timelineRange, timezone);
  if (!placement) return null;

  return (
    <Link
      aria-label={`Bloqueio: ${block.reason ?? "Período indisponível"}`}
      className="absolute inset-x-2 z-[5] overflow-hidden rounded-md border border-dashed border-tesText-muted bg-surface-mist/90 px-2.5 py-2 text-left text-sm font-extrabold text-tesText-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
      href={`${routes.therapist.agenda}?aba=bloqueios` as Route}
      style={{ height: placement.height, top: placement.top }}
    >
      <span className="block truncate">{block.reason ?? "Indisponível"}</span>
    </Link>
  );
}

function TimelineHold({
  hold,
  timelineRange,
  timezone,
}: {
  hold: TherapistCalendarHold;
  timelineRange: TimelineRange;
  timezone: string;
}) {
  const placement = timelinePlacement(
    hold.startsAt,
    hold.endsAt,
    timelineRange,
    timezone,
  );
  if (!placement) return null;
  const style = colorStyles[hold.colorKey];

  return (
    <div
      aria-label={`Horário temporariamente reservado para ${hold.serviceTitle}`}
      className={`absolute inset-x-2 z-[6] overflow-hidden rounded-md border border-dashed px-2.5 py-2 text-sm font-extrabold ${style.border} ${style.surface} ${style.text}`}
      style={{ height: placement.height, top: placement.top }}
    >
      Reserva em andamento · {hold.serviceTitle}
    </div>
  );
}

function MonthCalendar({
  bookings,
  days,
  onSelect,
  timezone,
  todayKey,
}: {
  bookings: TherapistCalendarBooking[];
  days: string[];
  onSelect: (booking: TherapistCalendarBooking) => void;
  timezone: string;
  todayKey: string;
}) {
  return (
    <section
      aria-label="Agenda mensal"
      className="overflow-hidden rounded-[14px] border border-brand-lavender/70 bg-white"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-brand-lavender bg-surface-soft/70">
            {weekDayLabels.map((day) => (
              <span
                className="py-3 text-center text-[10px] font-extrabold text-tesText-muted md:text-[11px]"
                key={day}
              >
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayBookings = bookings.filter(
                (booking) =>
                  dateKeyForInstant(booking.startsAt, timezone) === day,
              );
              return (
                <div
                  className="min-h-[126px] border-b border-r border-brand-lavender/60 p-2"
                  key={day}
                >
                  <span
                    className={`grid size-7 place-items-center rounded-full text-sm font-extrabold ${
                      day === todayKey
                        ? "bg-brand-primary text-white"
                        : "text-brand-deep"
                    }`}
                  >
                    {Number(day.slice(-2))}
                  </span>
                  <div className="mt-2 grid gap-1">
                    {dayBookings.slice(0, 3).map((booking) => {
                      const style = colorStyles[booking.colorKey];
                      const presentation = mapSessionPresentation(booking);
                      const isClosed = isClosedCalendarBooking(
                        presentation.state,
                        booking.financialStatus,
                      );
                      return (
                        <button
                          aria-label={`${formatTime(booking.startsAt, timezone)}, ${booking.patientName}, ${presentation.label}`}
                          className={`flex min-h-11 items-center gap-1.5 rounded border px-2.5 text-left text-sm font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary ${isClosed ? "border-tesText-muted text-tesText-secondary" : `border-transparent ${style.surface} ${style.text}`}`}
                          data-session-state={presentation.state}
                          key={booking.bookingId}
                          onClick={() => onSelect(booking)}
                          style={isClosed ? closedBookingPattern : undefined}
                          type="button"
                        >
                          <span>{formatTime(booking.startsAt, timezone)}</span>
                          <span className="truncate">
                            {booking.patientName}
                          </span>
                        </button>
                      );
                    })}
                    {dayBookings.length > 3 ? (
                      <span className="text-[10px] font-bold text-tesText-muted md:text-[11px]">
                        +{dayBookings.length - 3} sessão(ões)
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileChronologicalList({
  blocks,
  bookings,
  holds,
  onSelect,
  timezone,
}: {
  blocks: TherapistCalendarBlock[];
  bookings: TherapistCalendarBooking[];
  holds: TherapistCalendarHold[];
  onSelect: (booking: TherapistCalendarBooking) => void;
  timezone: string;
}) {
  const items = buildMobileCalendarItems({ blocks, bookings, holds, timezone });

  return (
    <section
      aria-label="Lista cronológica da agenda"
      className="rounded-[14px] border border-brand-lavender/70 bg-white md:hidden"
    >
      <div className="border-b border-brand-lavender/60 px-4 py-3">
        <h2 className="text-sm font-extrabold text-brand-deep">
          Agenda em ordem do dia
        </h2>
        <p className="mt-1 text-[11px] font-bold text-tesText-secondary">
          {items.length} item(ns) no período filtrado.
        </p>
      </div>
      {items.length ? (
        <div className="divide-y divide-brand-lavender/60">
          {items.map((item) => {
            if (item.kind === "booking") {
              const style = colorStyles[item.booking.colorKey];
              const presentation = mapSessionPresentation(item.booking);
              const isClosed = isClosedCalendarBooking(
                presentation.state,
                item.booking.financialStatus,
              );
              return (
                <button
                  aria-label={`Sessão de ${item.booking.serviceTitle}: ${item.booking.patientName}, ${item.timeRange}, ${presentation.label}`}
                  className="grid min-h-[86px] w-full grid-cols-[52px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                  data-session-state={presentation.state}
                  key={item.id}
                  onClick={() => onSelect(item.booking)}
                  style={isClosed ? closedBookingPattern : undefined}
                  type="button"
                >
                  <span
                    className={`grid size-11 place-items-center rounded-xl border text-[11px] font-extrabold ${isClosed ? "border-tesText-muted text-tesText-secondary" : `border-transparent text-white ${style.badge}`}`}
                    style={isClosed ? closedBookingPattern : undefined}
                  >
                    {item.time}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-extrabold uppercase text-tesText-muted md:text-[11px]">
                      {item.dateLabel} · {presentation.label}
                    </span>
                    <span className="mt-1 block truncate text-sm font-extrabold text-brand-deep">
                      {item.booking.patientName}
                    </span>
                    <span
                      className={`block truncate text-sm font-bold ${style.text}`}
                    >
                      {item.booking.serviceTitle}
                    </span>
                  </span>
                </button>
              );
            }

            if (item.kind === "hold") {
              const style = colorStyles[item.hold.colorKey];
              return (
                <div
                  aria-label={`Reserva temporária de ${item.hold.serviceTitle}, ${item.timeRange}`}
                  className="grid min-h-[78px] grid-cols-[52px_minmax(0,1fr)] items-center gap-3 px-4 py-3"
                  key={item.id}
                >
                  <span
                    className={`grid size-11 place-items-center rounded-xl border border-dashed text-[11px] font-extrabold ${style.border} ${style.surface} ${style.text}`}
                  >
                    {item.time}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-extrabold uppercase text-tesText-muted md:text-[11px]">
                      {item.dateLabel} · Em reserva
                    </span>
                    <span className="mt-1 block truncate text-sm font-extrabold text-brand-deep">
                      {item.hold.serviceTitle}
                    </span>
                    <span className="block text-sm font-bold text-tesText-secondary">
                      Expira em breve se não houver pagamento.
                    </span>
                  </span>
                </div>
              );
            }

            return (
              <Link
                aria-label={`Bloqueio: ${item.block.reason ?? "Período indisponível"}, ${item.timeRange}`}
                className="grid min-h-[78px] grid-cols-[52px_minmax(0,1fr)] items-center gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                href={`${routes.therapist.agenda}?aba=bloqueios` as Route}
                key={item.id}
              >
                <span className="grid size-11 place-items-center rounded-xl border border-dashed border-tesText-muted bg-surface-mist text-[11px] font-extrabold text-tesText-secondary">
                  {item.block.allDay ? "Dia" : item.time}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-extrabold uppercase text-tesText-muted md:text-[11px]">
                    {item.dateLabel} · Bloqueio
                  </span>
                  <span className="mt-1 block truncate text-sm font-extrabold text-brand-deep">
                    {item.block.reason ?? "Período indisponível"}
                  </span>
                  <span className="block text-sm font-bold text-tesText-secondary">
                    Revisar bloqueio
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="p-5 text-sm font-semibold leading-6 text-tesText-secondary">
          Nenhum item encontrado com os filtros atuais.
        </p>
      )}
    </section>
  );
}

function CalendarLegend({
  services,
}: {
  services: TherapistCalendarReadModel["services"];
}) {
  if (services.length === 0) return null;
  const legendItems = (
    <>
      {services.map((service) => (
        <span
          className="inline-flex items-center gap-2 text-[10px] font-extrabold text-tesText-secondary md:text-[11px]"
          key={service.id}
        >
          <span
            aria-hidden="true"
            className={`size-3 rounded-sm ${colorStyles[service.colorKey].badge}`}
          />
          {service.title}
        </span>
      ))}
      <span className="inline-flex items-center gap-2 text-[10px] font-extrabold text-tesText-secondary md:text-[11px]">
        <span aria-hidden="true" className="size-3 rounded-sm bg-[#77738d]" />
        Indisponível
      </span>
      <span className="inline-flex items-center gap-2 text-[10px] font-extrabold text-tesText-secondary md:text-[11px]">
        <span
          aria-hidden="true"
          className="size-3 rounded-sm border border-tesText-muted"
          style={closedBookingPattern}
        />
        Cancelada ou reembolsada
      </span>
    </>
  );
  return (
    <>
      <details className="group mt-4 md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
          Legenda da agenda
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-brand-primary transition group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-wrap gap-x-5 gap-y-3 pb-2 pt-1">
          {legendItems}
        </div>
      </details>
      <section
        aria-label="Legenda das terapias"
        className="mt-4 hidden flex-wrap gap-x-5 gap-y-3 px-1 py-3 md:flex"
      >
        {legendItems}
      </section>
    </>
  );
}

function isClosedCalendarBooking(
  presentationState: ReturnType<typeof mapSessionPresentation>["state"],
  financialStatus: TherapistCalendarBooking["financialStatus"],
) {
  return (
    presentationState === "cancelled" ||
    (presentationState === "refunded" &&
      financialStatus !== SessionFinancialStatus.PartiallyRefunded)
  );
}

function TodayCard({
  bookings,
  onSelect,
  timezone,
}: {
  bookings: TherapistCalendarBooking[];
  onSelect: (booking: TherapistCalendarBooking) => void;
  timezone: string;
}) {
  const todayKey = dateKeyForInstant(new Date().toISOString(), timezone);

  return (
    <article className="rounded-xl bg-white p-5 xl:rounded-none xl:bg-transparent xl:px-0 xl:py-6">
      <h2 className="text-lg font-extrabold text-brand-deep">
        Sessões de hoje
      </h2>
      <p className="mt-1 text-xs font-bold text-tesText-secondary">
        {formatTodayLabel(timezone)}
      </p>
      <p className="mt-3 text-sm font-extrabold text-brand-primary">
        {bookings.length} sessão(ões)
      </p>
      {bookings.length ? (
        <div className="mt-4 divide-y divide-brand-lavender/60">
          {bookings.map((booking) => (
            <button
              className="grid min-h-[74px] w-full grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
              key={booking.bookingId}
              onClick={() => onSelect(booking)}
              type="button"
            >
              <span
                className={`grid size-9 place-items-center rounded-full text-[10px] font-extrabold text-white md:text-[11px] ${colorStyles[booking.colorKey].badge}`}
              >
                {initials(booking.patientName)}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-extrabold text-brand-primary md:text-[11px]">
                  {formatTimeRange(booking.startsAt, booking.endsAt, timezone)}
                </span>
                <span className="mt-1 block truncate text-sm font-extrabold text-brand-deep">
                  {booking.patientName}
                </span>
                <span className="block truncate text-[10px] font-bold text-tesText-secondary md:text-[11px]">
                  {booking.serviceTitle}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="text-brand-primary"
                size={16}
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-surface-soft p-4 text-sm font-semibold leading-5 text-tesText-secondary">
          Nenhuma sessão agendada para hoje.
        </p>
      )}
      <Link
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-lavender text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
        href={calendarHref("day", todayKey)}
      >
        <CalendarDays aria-hidden="true" size={16} />
        Ver agenda do dia
      </Link>
    </article>
  );
}

function AttentionCard({
  items,
  timezone,
}: {
  items: TherapistCalendarAttentionItem[];
  timezone: string;
}) {
  return (
    <article
      className={`rounded-xl p-5 xl:rounded-none xl:border-t xl:border-brand-lavender/60 xl:bg-transparent xl:px-0 xl:py-6 ${
        items.length ? "bg-status-warningBg/30" : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-brand-deep">
          Pendências da agenda
        </h2>
        <span className="grid min-w-7 place-items-center rounded-full bg-brand-lavenderSoft px-2 py-1 text-[10px] font-extrabold text-brand-primary md:text-[11px]">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <div className="mt-4 divide-y divide-brand-lavender/60">
          {items.slice(0, 4).map((item) => (
            <Link
              className="grid min-h-[72px] grid-cols-[34px_minmax(0,1fr)_16px] items-center gap-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
              href={routes.therapist.sessionDetail(item.bookingId) as Route}
              key={item.id}
            >
              <span
                className={`grid size-8 place-items-center rounded-full ${
                  item.kind === "reschedule"
                    ? "bg-status-warningBg text-status-warning"
                    : item.kind === "pending_payment"
                      ? "bg-brand-cyanSoft text-status-info"
                      : "bg-status-dangerBg text-status-danger"
                }`}
              >
                {item.kind === "pending_payment" ? (
                  <CreditCard aria-hidden="true" size={15} />
                ) : item.kind === "reschedule" ? (
                  <Clock3 aria-hidden="true" size={15} />
                ) : (
                  <AlertCircle aria-hidden="true" size={15} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold text-brand-deep">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[10px] font-bold text-tesText-secondary md:text-[11px]">
                  {item.description}
                </span>
                <span className="block text-[10px] font-bold text-tesText-muted md:text-[11px]">
                  {formatCompactDateTime(item.startsAt, timezone)}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="text-brand-primary"
                size={15}
              />
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-status-successBg p-4 text-sm font-semibold leading-5 text-status-success">
          Nenhuma pendência operacional neste momento.
        </p>
      )}
    </article>
  );
}

function DemandCard({ demand }: { demand: TherapistCalendarDemandItem[] }) {
  const values = new Map(
    demand.map((item) => [`${item.dayOfWeek}-${item.hourBlock}`, item.count]),
  );
  const maximum = Math.max(0, ...demand.map((item) => item.count));
  return (
    <article className="rounded-xl bg-white p-5 md:col-span-2 xl:col-span-1 xl:rounded-none xl:border-t xl:border-brand-lavender/60 xl:bg-transparent xl:px-0 xl:py-6">
      <h2 className="text-lg font-extrabold text-brand-deep">
        Acompanhe sua agenda
      </h2>
      <p className="mt-1 text-[10px] font-bold text-tesText-muted md:text-[11px]">
        Com base nos últimos 90 dias
      </p>
      <details className="group mt-4 md:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary">
          Ver distribuição dos horários
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition group-open:rotate-180"
          />
        </summary>
        <DemandHeatmapContent maximum={maximum} values={values} />
      </details>
      <div className="hidden md:block">
        <DemandHeatmapContent maximum={maximum} values={values} />
      </div>
    </article>
  );
}

function DemandHeatmapContent({
  maximum,
  values,
}: {
  maximum: number;
  values: Map<string, number>;
}) {
  return (
    <>
      <div className="mt-5 grid grid-cols-[38px_repeat(7,minmax(0,1fr))] gap-1.5 text-center">
        <span aria-hidden="true" />
        {weekDayLabels.map((day) => (
          <span
            className="text-[10px] font-extrabold text-tesText-muted md:text-[11px]"
            key={day}
          >
            {day}
          </span>
        ))}
        {hourBlocks.flatMap((hour) => [
          <span
            className="self-center text-[10px] font-extrabold text-tesText-muted md:text-[11px]"
            key={`label-${hour}`}
          >
            {String(hour).padStart(2, "0")}h
          </span>,
          ...[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const count = values.get(`${day}-${hour}`) ?? 0;
            return (
              <span
                className={`grid aspect-square min-h-6 place-items-center rounded text-[10px] font-extrabold md:text-[11px] ${heatmapStyle(count, maximum)}`}
                key={`${day}-${hour}`}
                title={`${count} sessão(ões)`}
              >
                {count}
              </span>
            );
          }),
        ])}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] font-bold text-tesText-secondary md:text-[11px]">
        <HeatLegend className="bg-[#f3effb]" label="Nenhuma procura" />
        <HeatLegend className="bg-[#d8dcff]" label="Baixa procura" />
        <HeatLegend className="bg-[#b895ff]" label="Média procura" />
        <HeatLegend className="bg-[#7b2cf4]" label="Alta procura" />
      </div>
    </>
  );
}

function HeatLegend({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-3 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function TesScheduleTip({ demand }: { demand: TherapistCalendarDemandItem[] }) {
  const peak = [...demand].sort((left, right) => right.count - left.count)[0];
  return (
    <article className="mt-7 border-l-2 border-brand-primary bg-brand-lavenderSoft/70 px-5 py-6 text-left sm:px-6">
      <div className="inline-flex items-center gap-2">
        <Sparkles aria-hidden="true" className="text-brand-primary" size={19} />
        <h2 className="font-display text-[24px] font-light italic text-brand-deep">
          Dica do TES
        </h2>
      </div>
      <p className="mt-3 max-w-[720px] text-sm font-semibold leading-6 text-tesText-secondary">
        {peak
          ? `${fullDayLabel(peak.dayOfWeek)} entre ${String(peak.hourBlock).padStart(2, "0")}h e ${String(peak.hourBlock + 2).padStart(2, "0")}h concentrou mais sessões no período analisado.`
          : "Conforme suas sessões forem acontecendo, este espaço mostrará os períodos mais procurados."}
      </p>
      <Link
        className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
        href={routes.therapist.insights as Route}
      >
        Ver todo o acompanhamento da agenda
        <ArrowRight aria-hidden="true" size={15} />
      </Link>
    </article>
  );
}

function BookingDialog({
  booking,
  onClose,
  timezone,
}: {
  booking: TherapistCalendarBooking;
  onClose: () => void;
  timezone: string;
}) {
  const presentation = mapSessionPresentation(booking);
  const style = colorStyles[booking.colorKey];
  return (
    <TESDialog
      className="max-w-lg"
      description={`${formatLongDate(booking.startsAt, timezone)} · ${formatTimeRange(booking.startsAt, booking.endsAt, timezone)}`}
      onClose={onClose}
      title={booking.patientName}
    >
      <div className={`rounded-xl border p-4 ${style.border} ${style.surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-extrabold ${style.text}`}>
              {booking.serviceTitle}
            </p>
            <p className="mt-1 text-xs font-bold text-tesText-secondary">
              {booking.therapyName}
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-brand-deep md:text-[11px]">
            {presentation.label}
          </span>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
        {presentation.description}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
          onClick={onClose}
          type="button"
        >
          Voltar à agenda
        </button>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
          href={routes.therapist.sessionDetail(booking.bookingId) as Route}
        >
          Abrir sessão
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </TESDialog>
  );
}

function matchesBookingFilters(
  booking: TherapistCalendarBooking,
  filters: CalendarFiltersState,
) {
  if (filters.serviceId !== "all" && booking.serviceId !== filters.serviceId) {
    return false;
  }
  if (
    !matchesTextFilter(filters.query, [
      booking.patientName,
      booking.serviceTitle,
      booking.therapyName,
    ])
  ) {
    return false;
  }
  if (filters.status === "paid") {
    return String(booking.financialStatus) === "paid";
  }
  if (filters.status === "pending_payment") {
    return (
      String(booking.financialStatus) === "pending" ||
      String(booking.financialStatus) === "processing" ||
      String(booking.bookingStatus) === "pending_payment"
    );
  }
  if (filters.status === "reschedule") {
    return booking.rescheduleStatus !== null;
  }
  return true;
}

function matchesHoldFilters(
  hold: TherapistCalendarHold,
  filters: CalendarFiltersState,
) {
  if (filters.status !== "all" && filters.status !== "pending_payment") {
    return false;
  }
  if (filters.serviceId !== "all" && hold.serviceId !== filters.serviceId) {
    return false;
  }
  return matchesTextFilter(filters.query, [hold.serviceTitle]);
}

function matchesBlockFilters(
  block: TherapistCalendarBlock,
  filters: CalendarFiltersState,
) {
  if (filters.status !== "all") return false;
  if (
    filters.serviceId !== "all" &&
    block.serviceId !== null &&
    block.serviceId !== filters.serviceId
  ) {
    return false;
  }
  return matchesTextFilter(filters.query, [
    block.reason ?? "Período indisponível",
  ]);
}

function matchesTextFilter(query: string, values: string[]) {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  return values.some((value) => normalizeSearch(value).includes(normalized));
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildMobileCalendarItems({
  blocks,
  bookings,
  holds,
  timezone,
}: {
  blocks: TherapistCalendarBlock[];
  bookings: TherapistCalendarBooking[];
  holds: TherapistCalendarHold[];
  timezone: string;
}) {
  return [
    ...bookings.map((booking) => ({
      booking,
      dateLabel: formatCompactDate(booking.startsAt, timezone),
      id: `booking-${booking.bookingId}`,
      kind: "booking" as const,
      sortAt: booking.startsAt,
      time: formatTime(booking.startsAt, timezone),
      timeRange: formatTimeRange(booking.startsAt, booking.endsAt, timezone),
    })),
    ...holds.map((hold) => ({
      dateLabel: formatCompactDate(hold.startsAt, timezone),
      hold,
      id: `hold-${hold.id}`,
      kind: "hold" as const,
      sortAt: hold.startsAt,
      time: formatTime(hold.startsAt, timezone),
      timeRange: formatTimeRange(hold.startsAt, hold.endsAt, timezone),
    })),
    ...blocks.map((block) => ({
      block,
      dateLabel: formatCompactDate(block.startsAt, timezone),
      id: `block-${block.id}`,
      kind: "block" as const,
      sortAt: block.startsAt,
      time: formatTime(block.startsAt, timezone),
      timeRange: block.allDay
        ? "dia inteiro"
        : formatTimeRange(block.startsAt, block.endsAt, timezone),
    })),
  ].sort(
    (left, right) =>
      new Date(left.sortAt).getTime() - new Date(right.sortAt).getTime(),
  );
}

function calendarHref(view: TherapistCalendarView, date: string): Route {
  return `${routes.therapist.agenda}?aba=calendario&visao=${view}&data=${date}` as Route;
}

type TimelineRange = {
  endHour: number;
  startHour: number;
};

function timelineRangeForCalendar({
  blocks,
  bookings,
  days,
  holds,
  scheduleRules,
  timezone,
}: {
  blocks: TherapistCalendarBlock[];
  bookings: TherapistCalendarBooking[];
  days: string[];
  holds: TherapistCalendarHold[];
  scheduleRules: TherapistScheduleRule[] | null;
  timezone: string;
}): TimelineRange {
  const visibleDays = new Set(days.map(dayOfWeek));
  const startMinutes: number[] = [];
  const endMinutes: number[] = [];

  for (const rule of scheduleRules ?? []) {
    if (!rule.isActive || !visibleDays.has(rule.dayOfWeek)) continue;
    startMinutes.push(clockMinutes(rule.startTime));
    endMinutes.push(clockMinutes(rule.endTime));
  }

  for (const item of [...bookings, ...holds, ...blocks]) {
    if ("allDay" in item && item.allDay) {
      continue;
    }
    if (!days.includes(dateKeyForInstant(item.startsAt, timezone))) continue;

    const start = timeMinutes(item.startsAt, timezone);
    const end = timeMinutes(item.endsAt, timezone);
    startMinutes.push(start);
    endMinutes.push(end > start ? end : 24 * 60);
  }

  if (startMinutes.length === 0 || endMinutes.length === 0) {
    return defaultTimelineRange;
  }

  const startHour = Math.max(0, Math.floor(Math.min(...startMinutes) / 60));
  const endHour = Math.min(
    24,
    Math.max(startHour + 1, Math.ceil(Math.max(...endMinutes) / 60)),
  );

  return { endHour, startHour };
}

function timelinePlacement(
  startsAt: string,
  endsAt: string,
  timelineRange: TimelineRange,
  timezone: string,
) {
  const start = timeMinutes(startsAt, timezone);
  const localEnd = timeMinutes(endsAt, timezone);
  const end = localEnd > start ? localEnd : localEnd + 24 * 60;
  const visibleStart = timelineRange.startHour * 60;
  const visibleEnd = timelineRange.endHour * 60;
  if (end <= visibleStart || start >= visibleEnd) return null;
  return {
    height: Math.max(
      34,
      ((Math.min(end, visibleEnd) - Math.max(start, visibleStart)) / 60) *
        hourHeight -
        4,
    ),
    top: ((Math.max(start, visibleStart) - visibleStart) / 60) * hourHeight + 2,
  };
}

function dateKeysBetween(start: string, endExclusive: string) {
  const result: string[] = [];
  for (
    let current = start;
    current < endExclusive;
    current = addDays(current, 1)
  ) {
    result.push(current);
  }
  return result;
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dayOfWeek(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

function dateKeyForInstant(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function timeMinutes(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: timezone,
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return Number(values.hour) * 60 + Number(values.minute);
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatTimeRange(startsAt: string, endsAt: string, timezone: string) {
  return `${formatTime(startsAt, timezone)} – ${formatTime(endsAt, timezone)}`;
}

function formatCompactDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatCompactDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
    weekday: "short",
  }).format(new Date(value));
}

function formatTodayLabel(timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: timezone,
    weekday: "long",
  }).format(new Date());
}

function formatLongDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatPeriodLabel(data: TherapistCalendarReadModel) {
  const start = new Date(`${data.range.localStart}T12:00:00Z`);
  const end = new Date(
    `${addDays(data.range.localEndExclusive, -1)}T12:00:00Z`,
  );
  if (data.view === "day") {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "long",
      weekday: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start);
  }
  if (data.view === "month") {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${data.anchorDate}T12:00:00Z`));
  }
  const startLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

function heatmapStyle(count: number, maximum: number) {
  if (count === 0 || maximum === 0) return "bg-[#f3effb] text-tesText-muted";
  const ratio = count / maximum;
  if (ratio <= 0.33) return "bg-[#d8dcff] text-brand-deep";
  if (ratio <= 0.66) return "bg-[#b895ff] text-brand-deep";
  return "bg-[#7b2cf4] text-white";
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function fullDayLabel(day: number) {
  return (
    [
      "Domingos",
      "Segundas",
      "Terças",
      "Quartas",
      "Quintas",
      "Sextas",
      "Sábados",
    ][day] ?? "Este período"
  );
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
