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
  Clock3,
  Construction,
  CreditCard,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { mapSessionPresentation } from "@/features/bookings";
import { TESDialog } from "@/components/tes/tes-dialog";
import { routes } from "@/lib/routes";

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
const timelineStartHour = 8;
const timelineEndHour = 22;
const hourHeight = 66;

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
}: {
  data: TherapistCalendarReadModel;
}) {
  const router = useRouter();
  const [selectedBooking, setSelectedBooking] =
    useState<TherapistCalendarBooking | null>(null);
  const [filters, setFilters] = useState<CalendarFiltersState>({
    query: "",
    serviceId: "all",
    status: "all",
  });
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
    <main className="mx-auto w-full max-w-[1180px] pb-14 text-tesText-primary">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-[36px] font-light leading-tight text-brand-deep sm:text-[42px]">
            Minha agenda
          </h1>
          <p className="mt-1 max-w-[540px] text-sm font-semibold leading-6 text-tesText-secondary">
            Organize seus horários, acompanhe seus encontros e ofereça mais
            momentos de acolhimento.
          </p>
        </div>
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
      </header>

      <AgendaTabs />

      <section
        aria-label="Controles do calendário"
        className="mt-3 flex flex-col gap-4 rounded-[14px] border border-brand-lavender/50 bg-white p-4 shadow-card md:flex-row md:items-center md:justify-between"
      >
        <div className="grid grid-cols-3 gap-2">
          {(["day", "week", "month"] as const).map((view) => (
            <Link
              aria-current={data.view === view ? "page" : undefined}
              className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-5 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary ${
                data.view === view
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-brand-lavender bg-white text-brand-deep hover:border-brand-primary"
              }`}
              href={calendarHref(view, data.anchorDate)}
              key={view}
            >
              {view === "day" ? "Dia" : view === "week" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>

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
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary"
              size={18}
            />
            <input
              className="min-h-11 w-full min-w-0 rounded-lg border border-brand-lavender bg-white py-2 pl-10 pr-3 text-xs font-extrabold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 sm:min-w-[250px] sm:text-sm"
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
      </section>

      <CalendarFilters
        filters={filters}
        onChange={setFilters}
        resultCount={filteredBookings.length}
        services={data.services}
        totalCount={data.bookings.length}
      />

      <div className="mt-4 flex items-center justify-between gap-4 px-1">
        <h2 className="text-sm font-extrabold capitalize text-brand-deep sm:text-base">
          {periodLabel}
        </h2>
        <p className="text-xs font-bold text-tesText-muted">{data.timezone}</p>
      </div>

      <div className="mt-3 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
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
                timezone={data.timezone}
                todayKey={todayKey}
              />
            )}
          </div>

          <CalendarLegend services={data.services} />
          <TesScheduleTip demand={data.demand} />
        </div>

        <aside className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <TodayCard
            bookings={todayBookings}
            onSelect={setSelectedBooking}
            timezone={data.timezone}
          />
          <AttentionCard items={data.attentionItems} timezone={data.timezone} />
          <DemandCard demand={data.demand} />
        </aside>
      </div>

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

function AgendaTabs() {
  const tabs = [
    { href: "?aba=calendario", id: "calendario", label: "Calendário" },
    { href: "?aba=horarios", id: "horarios", label: "Horários" },
    { href: "?aba=bloqueios", id: "bloqueios", label: "Bloqueios" },
  ];

  return (
    <nav
      aria-label="Seções da agenda"
      className="mt-5 grid max-w-[520px] grid-cols-3 overflow-hidden rounded-xl border border-brand-lavender bg-white"
    >
      {tabs.map((tab) => (
        <Link
          aria-current={tab.id === "calendario" ? "page" : undefined}
          className={`relative flex min-h-14 items-center justify-center px-3 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary ${
            tab.id === "calendario"
              ? "text-brand-deep after:absolute after:inset-x-1 after:bottom-0 after:h-1 after:rounded-full after:bg-brand-primary"
              : "text-tesText-secondary hover:text-brand-primary"
          }`}
          href={tab.href as Route}
          key={tab.id}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function CalendarFilters({
  filters,
  onChange,
  resultCount,
  services,
  totalCount,
}: {
  filters: CalendarFiltersState;
  onChange: (filters: CalendarFiltersState) => void;
  resultCount: number;
  services: TherapistCalendarReadModel["services"];
  totalCount: number;
}) {
  const hasFilters =
    filters.query.trim() !== "" ||
    filters.serviceId !== "all" ||
    filters.status !== "all";

  return (
    <section
      aria-label="Filtros do calendário"
      className="mt-4 rounded-[14px] border border-brand-lavender/50 bg-white p-4 shadow-card"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase text-tesText-muted">
            <Search aria-hidden="true" size={14} />
            Buscar
          </span>
          <input
            className="min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none placeholder:text-tesText-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            onChange={(event) =>
              onChange({ ...filters, query: event.target.value })
            }
            placeholder="Paciente, terapia ou serviço"
            type="search"
            value={filters.query}
          />
        </label>

        <label className="min-w-0 lg:w-[220px]">
          <span className="mb-1 block text-[10px] font-extrabold uppercase text-tesText-muted">
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
          <span className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase text-tesText-muted">
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
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender px-4 text-xs font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!hasFilters}
          onClick={() =>
            onChange({ query: "", serviceId: "all", status: "all" })
          }
          type="button"
        >
          <X aria-hidden="true" size={15} />
          Limpar
        </button>
      </div>
      <p
        aria-live="polite"
        className="mt-3 text-[11px] font-bold text-tesText-secondary"
      >
        {resultCount} de {totalCount} encontro(s) nesta visualização.
      </p>
    </section>
  );
}

function TimelineCalendar({
  blocks,
  bookings,
  days,
  holds,
  onSelect,
  timezone,
  todayKey,
}: {
  blocks: TherapistCalendarBlock[];
  bookings: TherapistCalendarBooking[];
  days: string[];
  holds: TherapistCalendarHold[];
  onSelect: (booking: TherapistCalendarBooking) => void;
  timezone: string;
  todayKey: string;
}) {
  const gridHeight = (timelineEndHour - timelineStartHour) * hourHeight;
  const widthClass = days.length === 1 ? "min-w-[360px]" : "min-w-[760px]";

  return (
    <section className="overflow-hidden rounded-[14px] border border-brand-lavender/70 bg-white shadow-card">
      <div className="overflow-x-auto">
        <div className={widthClass}>
          <div
            className="grid border-b border-brand-lavender"
            style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
          >
            <span aria-hidden="true" />
            {days.map((day) => {
              const current = day === todayKey;
              return (
                <div className="py-3 text-center" key={day}>
                  <span className="block text-[10px] font-extrabold text-tesText-muted">
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
              gridTemplateColumns: `64px repeat(${days.length}, 1fr)`,
              height: gridHeight,
            }}
          >
            <div className="relative border-r border-brand-lavender/70">
              {Array.from(
                { length: timelineEndHour - timelineStartHour + 1 },
                (_, index) => timelineStartHour + index,
              ).map((hour) => (
                <span
                  className="absolute right-3 -translate-y-1/2 text-[10px] font-bold text-tesText-muted"
                  key={hour}
                  style={{ top: (hour - timelineStartHour) * hourHeight }}
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
                {Array.from(
                  { length: timelineEndHour - timelineStartHour + 1 },
                  (_, hourIndex) => (
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
                      timezone={timezone}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="border-t border-brand-lavender/60 px-4 py-3 text-center text-[11px] font-bold text-tesText-secondary">
        Selecione um encontro para ver os detalhes.
      </p>
    </section>
  );
}

function TimelineBooking({
  booking,
  onSelect,
  timezone,
}: {
  booking: TherapistCalendarBooking;
  onSelect: (booking: TherapistCalendarBooking) => void;
  timezone: string;
}) {
  const placement = timelinePlacement(
    booking.startsAt,
    booking.endsAt,
    timezone,
  );
  if (!placement) return null;
  const style = colorStyles[booking.colorKey];
  const status = mapSessionPresentation(booking);

  return (
    <button
      aria-label={`${booking.serviceTitle} com ${booking.patientName}, ${formatTimeRange(booking.startsAt, booking.endsAt, timezone)}`}
      className={`absolute inset-x-1 z-10 overflow-hidden rounded-md border p-1.5 text-left shadow-sm transition hover:z-20 hover:brightness-[0.98] focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-primary ${style.border} ${style.surface}`}
      onClick={() => onSelect(booking)}
      style={{ height: placement.height, top: placement.top }}
      type="button"
    >
      <span
        className={`block text-[10px] font-extrabold leading-none ${style.text}`}
      >
        {formatTime(booking.startsAt, timezone)}
      </span>
      <span className="mt-1 block truncate text-[9px] font-extrabold leading-none text-brand-deep">
        {booking.serviceTitle}
      </span>
      <span className="mt-1 block truncate text-[8px] font-bold leading-none text-tesText-secondary">
        {booking.patientName}
      </span>
      <span className="sr-only">{status.label}</span>
    </button>
  );
}

function TimelineBlock({
  block,
  timezone,
}: {
  block: TherapistCalendarBlock;
  timezone: string;
}) {
  const placement = block.allDay
    ? { height: 32, top: 2 }
    : timelinePlacement(block.startsAt, block.endsAt, timezone);
  if (!placement) return null;

  return (
    <Link
      aria-label={`Bloqueio: ${block.reason ?? "Período indisponível"}`}
      className="absolute inset-x-1 z-[5] overflow-hidden rounded-md border border-dashed border-tesText-muted bg-surface-mist/90 p-2 text-left text-[9px] font-extrabold text-tesText-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
      href={`${routes.therapist.agenda}?aba=bloqueios` as Route}
      style={{ height: placement.height, top: placement.top }}
    >
      <span className="block truncate">{block.reason ?? "Indisponível"}</span>
    </Link>
  );
}

function TimelineHold({
  hold,
  timezone,
}: {
  hold: TherapistCalendarHold;
  timezone: string;
}) {
  const placement = timelinePlacement(hold.startsAt, hold.endsAt, timezone);
  if (!placement) return null;
  const style = colorStyles[hold.colorKey];

  return (
    <div
      aria-label={`Horário temporariamente reservado para ${hold.serviceTitle}`}
      className={`absolute inset-x-1 z-[6] overflow-hidden rounded-md border border-dashed p-2 text-[9px] font-extrabold ${style.border} ${style.surface} ${style.text}`}
      style={{ height: placement.height, top: placement.top }}
    >
      Em reserva · {hold.serviceTitle}
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
    <section className="overflow-hidden rounded-[14px] border border-brand-lavender/70 bg-white shadow-card">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-brand-lavender bg-surface-soft/70">
            {weekDayLabels.map((day) => (
              <span
                className="py-3 text-center text-[10px] font-extrabold text-tesText-muted"
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
                    className={`grid size-7 place-items-center rounded-full text-xs font-extrabold ${
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
                      return (
                        <button
                          className={`flex min-h-7 items-center gap-1 rounded px-2 text-left text-[9px] font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary ${style.surface} ${style.text}`}
                          key={booking.bookingId}
                          onClick={() => onSelect(booking)}
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
                      <span className="text-[9px] font-bold text-tesText-muted">
                        +{dayBookings.length - 3} encontro(s)
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
      className="rounded-[14px] border border-brand-lavender/70 bg-white shadow-card md:hidden"
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
              return (
                <button
                  aria-label={`Encontro de ${item.booking.serviceTitle}: ${item.booking.patientName}, ${item.timeRange}`}
                  className="grid min-h-[86px] w-full grid-cols-[52px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                  key={item.id}
                  onClick={() => onSelect(item.booking)}
                  type="button"
                >
                  <span
                    className={`grid size-11 place-items-center rounded-xl text-[11px] font-extrabold text-white ${style.badge}`}
                  >
                    {item.time}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-extrabold uppercase text-tesText-muted">
                      {item.dateLabel} · {presentation.label}
                    </span>
                    <span className="mt-1 block truncate text-sm font-extrabold text-brand-deep">
                      {item.booking.patientName}
                    </span>
                    <span
                      className={`block truncate text-xs font-bold ${style.text}`}
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
                    <span className="block text-[10px] font-extrabold uppercase text-tesText-muted">
                      {item.dateLabel} · Em reserva
                    </span>
                    <span className="mt-1 block truncate text-sm font-extrabold text-brand-deep">
                      {item.hold.serviceTitle}
                    </span>
                    <span className="block text-xs font-bold text-tesText-secondary">
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
                  <span className="block text-[10px] font-extrabold uppercase text-tesText-muted">
                    {item.dateLabel} · Bloqueio
                  </span>
                  <span className="mt-1 block truncate text-sm font-extrabold text-brand-deep">
                    {item.block.reason ?? "Período indisponível"}
                  </span>
                  <span className="block text-xs font-bold text-tesText-secondary">
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
  return (
    <section
      aria-label="Legenda das terapias"
      className="mt-4 flex flex-wrap gap-x-5 gap-y-3 rounded-xl border border-brand-lavender/60 bg-white px-4 py-3"
    >
      {services.map((service) => (
        <span
          className="inline-flex items-center gap-2 text-[10px] font-extrabold text-tesText-secondary"
          key={service.id}
        >
          <span
            className={`size-3 rounded-sm ${colorStyles[service.colorKey].badge}`}
          />
          {service.title}
        </span>
      ))}
      <span className="inline-flex items-center gap-2 text-[10px] font-extrabold text-tesText-secondary">
        <span className="size-3 rounded-sm bg-[#77738d]" />
        Indisponível
      </span>
    </section>
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
  return (
    <article className="rounded-[14px] border border-brand-lavender/60 bg-white p-5 shadow-card">
      <h2 className="text-base font-extrabold text-brand-deep">
        Quem você acolhe hoje
      </h2>
      <p className="mt-1 text-xs font-bold text-tesText-secondary">
        {bookings.length} encontro(s)
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
                className={`grid size-9 place-items-center rounded-full text-[10px] font-extrabold text-white ${colorStyles[booking.colorKey].badge}`}
              >
                {initials(booking.patientName)}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-extrabold text-brand-primary">
                  {formatTimeRange(booking.startsAt, booking.endsAt, timezone)}
                </span>
                <span className="mt-1 block truncate text-xs font-extrabold text-brand-deep">
                  {booking.patientName}
                </span>
                <span className="block truncate text-[9px] font-bold text-tesText-secondary">
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
        <p className="mt-4 rounded-lg bg-surface-soft p-4 text-xs font-bold leading-5 text-tesText-secondary">
          Nenhum encontro agendado para hoje.
        </p>
      )}
      <Link
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-lavender text-xs font-extrabold text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
        href={routes.therapist.sessions as Route}
      >
        <CalendarDays aria-hidden="true" size={16} />
        Ver sessões
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
    <article className="rounded-[14px] border border-brand-lavender/60 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-brand-deep">
          Precisam da sua atenção
        </h2>
        <span className="grid min-w-7 place-items-center rounded-full bg-brand-lavenderSoft px-2 py-1 text-[10px] font-extrabold text-brand-primary">
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
                <span className="block truncate text-[11px] font-extrabold text-brand-deep">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[9px] font-bold text-tesText-secondary">
                  {item.description}
                </span>
                <span className="block text-[9px] font-bold text-tesText-muted">
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
        <p className="mt-4 rounded-lg bg-status-successBg p-4 text-xs font-bold leading-5 text-status-success">
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
    <article className="rounded-[14px] border border-brand-lavender/60 bg-white p-5 shadow-card md:col-span-2 xl:col-span-1">
      <h2 className="text-base font-extrabold text-brand-deep">
        Insights para sua agenda
      </h2>
      <p className="mt-1 text-[10px] font-bold text-tesText-muted">
        Com base nos últimos 90 dias
      </p>
      <div className="mt-5 grid grid-cols-[36px_repeat(7,1fr)] gap-1 text-center">
        <span aria-hidden="true" />
        {weekDayLabels.map((day) => (
          <span
            className="text-[8px] font-extrabold text-tesText-muted"
            key={day}
          >
            {day}
          </span>
        ))}
        {hourBlocks.flatMap((hour) => [
          <span
            className="self-center text-[8px] font-extrabold text-tesText-muted"
            key={`label-${hour}`}
          >
            {String(hour).padStart(2, "0")}h
          </span>,
          ...[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const count = values.get(`${day}-${hour}`) ?? 0;
            return (
              <span
                className={`grid aspect-square min-h-5 place-items-center rounded text-[8px] font-extrabold ${heatmapStyle(count, maximum)}`}
                key={`${day}-${hour}`}
                title={`${count} encontro(s)`}
              >
                {count}
              </span>
            );
          }),
        ])}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[8px] font-bold text-tesText-secondary">
        <HeatLegend className="bg-[#f3effb]" label="Nenhuma procura" />
        <HeatLegend className="bg-[#d8dcff]" label="Baixa procura" />
        <HeatLegend className="bg-[#b895ff]" label="Média procura" />
        <HeatLegend className="bg-[#7b2cf4]" label="Alta procura" />
      </div>
    </article>
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
    <article className="mt-5 rounded-[14px] border border-brand-lavender/40 bg-brand-lavenderSoft/70 p-6 text-center shadow-card">
      <div className="inline-flex items-center gap-2">
        <Sparkles aria-hidden="true" className="text-brand-primary" size={19} />
        <h2 className="font-display text-[24px] font-light text-brand-deep">
          Dica TES
        </h2>
      </div>
      <p className="mx-auto mt-3 max-w-[620px] text-xs font-semibold leading-5 text-tesText-secondary">
        {peak
          ? `${fullDayLabel(peak.dayOfWeek)} entre ${String(peak.hourBlock).padStart(2, "0")}h e ${String(peak.hourBlock + 2).padStart(2, "0")}h concentrou mais encontros no período analisado.`
          : "Conforme seus encontros forem acontecendo, este espaço mostrará os períodos mais procurados."}
      </p>
      <Link
        className="mt-4 inline-flex min-h-10 items-center gap-2 text-xs font-extrabold text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
        href={routes.therapist.insights as Route}
      >
        Ver mais insights
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
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold text-brand-deep">
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

function timelinePlacement(startsAt: string, endsAt: string, timezone: string) {
  const start = timeMinutes(startsAt, timezone);
  const end = timeMinutes(endsAt, timezone);
  const visibleStart = timelineStartHour * 60;
  const visibleEnd = timelineEndHour * 60;
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
