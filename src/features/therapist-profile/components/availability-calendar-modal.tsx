"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { TESDialog } from "@/components/tes/tes-dialog";
import { buildPublicReservationUrl } from "@/features/booking/services/public-booking";
import { TrackedBookingLink } from "@/features/public-metrics";

import type { AvailabilityDay, TherapistProfileService } from "../types";

type AvailabilityCalendarModalProps = {
  initialDays: AvailabilityDay[];
  onClose: () => void;
  service: TherapistProfileService;
  therapistSlug: string;
};

type MonthAvailability = {
  dates: string[];
  horizonEndsAt: string;
  timezone: string;
};

type DayAvailability = {
  days: AvailabilityDay[];
  horizonEndsAt: string;
  timezone: string;
};

const weekDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function formatMonthTitle(date: Date) {
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateKeyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCalendarDates(monthStart: Date) {
  const firstVisibleDate = new Date(monthStart);
  firstVisibleDate.setDate(monthStart.getDate() - monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDate);
    date.setDate(firstVisibleDate.getDate() + index);
    return date;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readMonthAvailability(value: unknown): MonthAvailability | null {
  if (
    !isRecord(value) ||
    value.type !== "month" ||
    !isRecord(value.availability)
  )
    return null;
  const availability = value.availability;
  if (
    !Array.isArray(availability.dates) ||
    typeof availability.horizonEndsAt !== "string" ||
    typeof availability.timezone !== "string"
  )
    return null;
  return {
    dates: availability.dates.filter(
      (date): date is string =>
        typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date),
    ),
    horizonEndsAt: availability.horizonEndsAt,
    timezone: availability.timezone,
  };
}

function isAvailabilityDay(value: unknown): value is AvailabilityDay {
  return (
    isRecord(value) &&
    typeof value.date === "string" &&
    typeof value.dateLabel === "string" &&
    typeof value.dayLabel === "string" &&
    Array.isArray(value.slots)
  );
}

function readDayAvailability(value: unknown): DayAvailability | null {
  if (!isRecord(value) || value.type !== "day" || !isRecord(value.availability))
    return null;
  const availability = value.availability;
  if (
    !Array.isArray(availability.days) ||
    typeof availability.horizonEndsAt !== "string" ||
    typeof availability.timezone !== "string"
  )
    return null;
  return {
    days: availability.days.filter(isAvailabilityDay),
    horizonEndsAt: availability.horizonEndsAt,
    timezone: availability.timezone,
  };
}

export function AvailabilityCalendarModal({
  initialDays,
  onClose,
  service,
  therapistSlug,
}: AvailabilityCalendarModalProps) {
  const initialTimezone = service.availabilityTimezone ?? "America/Sao_Paulo";
  const initialMonth = useMemo(
    () =>
      getMonthStart(
        dateFromKey(formatDateKeyInTimezone(new Date(), initialTimezone)),
      ),
    [initialTimezone],
  );
  const initialHorizonMonth = useMemo(
    () =>
      getMonthStart(
        dateFromKey(
          formatDateKeyInTimezone(
            new Date(service.availabilityHorizonEndsAt ?? Date.now()),
            initialTimezone,
          ),
        ),
      ),
    [initialTimezone, service.availabilityHorizonEndsAt],
  );
  const monthCache = useRef(new Map<string, MonthAvailability>());
  const dayCache = useRef(new Map<string, AvailabilityDay>());
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [monthState, setMonthState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [availableDates, setAvailableDates] = useState<string[]>(
    initialDays.map((day) => day.date),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<AvailabilityDay | null>(null);
  const [dayState, setDayState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [horizonMonth, setHorizonMonth] = useState(initialHorizonMonth);
  const calendarDates = useMemo(
    () => getCalendarDates(visibleMonth),
    [visibleMonth],
  );
  const visibleMonthKey = getMonthKey(visibleMonth);
  const availableDateSet = useMemo(
    () => new Set(availableDates),
    [availableDates],
  );
  const canGoPrevious = visibleMonth.getTime() > initialMonth.getTime();
  const canGoNext = visibleMonth.getTime() < horizonMonth.getTime();

  useEffect(() => {
    const cached = monthCache.current.get(visibleMonthKey);
    if (cached) {
      setAvailableDates(cached.dates);
      setHorizonMonth(
        getMonthStart(
          dateFromKey(
            formatDateKeyInTimezone(
              new Date(cached.horizonEndsAt),
              cached.timezone,
            ),
          ),
        ),
      );
      setMonthState("idle");
      return;
    }

    const controller = new AbortController();
    setMonthState("loading");
    setAvailableDates([]);
    setSelectedDate(null);
    setSelectedDay(null);
    setDayState("idle");
    void fetch(
      `/api/public/service-availability?service=${encodeURIComponent(service.id)}&month=${visibleMonthKey}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) =>
        response.ok ? readMonthAvailability(await response.json()) : null,
      )
      .then((availability) => {
        if (!availability || controller.signal.aborted) {
          if (!controller.signal.aborted) setMonthState("error");
          return;
        }
        monthCache.current.set(visibleMonthKey, availability);
        setAvailableDates(availability.dates);
        setHorizonMonth(
          getMonthStart(
            dateFromKey(
              formatDateKeyInTimezone(
                new Date(availability.horizonEndsAt),
                availability.timezone,
              ),
            ),
          ),
        );
        setMonthState("idle");
      })
      .catch(() => {
        if (!controller.signal.aborted) setMonthState("error");
      });
    return () => controller.abort();
  }, [service.id, visibleMonthKey]);

  useEffect(() => {
    if (!selectedDate) return;
    const cached = dayCache.current.get(selectedDate);
    if (cached) {
      setSelectedDay(cached);
      setDayState("idle");
      return;
    }

    const controller = new AbortController();
    setSelectedDay(null);
    setDayState("loading");
    void fetch(
      `/api/public/service-availability?service=${encodeURIComponent(service.id)}&date=${selectedDate}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) =>
        response.ok ? readDayAvailability(await response.json()) : null,
      )
      .then((availability) => {
        if (!availability || controller.signal.aborted) {
          if (!controller.signal.aborted) setDayState("error");
          return;
        }
        const day =
          availability.days.find((item) => item.date === selectedDate) ?? null;
        if (day) dayCache.current.set(selectedDate, day);
        setSelectedDay(day);
        setDayState(day ? "idle" : "error");
      })
      .catch(() => {
        if (!controller.signal.aborted) setDayState("error");
      });
    return () => controller.abort();
  }, [selectedDate, service.id]);

  function moveMonth(direction: -1 | 1) {
    setVisibleMonth((month) => {
      const next = new Date(month);
      next.setMonth(month.getMonth() + direction);
      return getMonthStart(next);
    });
  }

  return (
    <TESDialog
      className="max-w-4xl text-brand-deep"
      description={`${service.title} · ${service.durationMinutes} min · ${service.priceLabel}`}
      onClose={onClose}
      title="Escolha um dia e horário"
    >
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-primary">
        Agenda completa
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <button
              aria-label="Mês anterior"
              className="grid size-11 place-items-center rounded-full border border-brand-lavender text-brand-primary outline-none transition enabled:hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-4 focus-visible:ring-brand-primary/20"
              disabled={!canGoPrevious}
              onClick={() => moveMonth(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <p className="text-base font-bold text-brand-deep">
              {formatMonthTitle(visibleMonth)}
            </p>
            <button
              aria-label="Próximo mês"
              className="grid size-11 place-items-center rounded-full border border-brand-lavender text-brand-primary outline-none transition enabled:hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-4 focus-visible:ring-brand-primary/20"
              disabled={!canGoNext}
              onClick={() => moveMonth(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2 text-center">
            {weekDays.map((day) => (
              <span
                className="text-xs font-bold uppercase text-tesText-muted"
                key={day}
              >
                {day}
              </span>
            ))}
            {calendarDates.map((date) => {
              const dateKey = formatDateKey(date);
              const isCurrentMonth = getMonthKey(date) === visibleMonthKey;
              const isSelected = selectedDate === dateKey;
              const isAvailable =
                isCurrentMonth && availableDateSet.has(dateKey);
              return (
                <button
                  aria-pressed={isSelected}
                  className={
                    isAvailable
                      ? isSelected
                        ? "min-h-12 rounded-xl bg-brand-primary text-sm font-bold text-white outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/20"
                        : "min-h-12 rounded-xl border border-brand-lavender bg-brand-lavenderSoft text-sm font-bold text-brand-primary outline-none transition hover:bg-brand-lavender focus-visible:ring-4 focus-visible:ring-brand-primary/20"
                      : "min-h-12 rounded-xl text-sm font-medium text-tesText-muted/45 disabled:cursor-not-allowed"
                  }
                  disabled={!isAvailable || monthState === "loading"}
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                  type="button"
                >
                  <span className={!isCurrentMonth ? "opacity-35" : undefined}>
                    {date.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          {monthState === "loading" ? (
            <p
              className="mt-4 text-sm font-medium text-tesText-muted"
              role="status"
            >
              Carregando horários deste mês…
            </p>
          ) : null}
          {monthState === "error" ? (
            <p
              className="mt-4 text-sm font-medium text-tesText-muted"
              role="alert"
            >
              Não foi possível carregar este mês. Tente novamente.
            </p>
          ) : null}
          {monthState === "idle" && !availableDates.length ? (
            <p className="mt-4 text-sm font-medium text-tesText-muted">
              Não há horários disponíveis neste mês.
            </p>
          ) : null}
        </div>

        <aside className="rounded-[18px] border border-brand-lavender bg-brand-lavenderSoft p-4">
          <h3 className="font-display text-2xl font-light italic text-brand-deep">
            {selectedDay
              ? `${selectedDay.dayLabel}, ${selectedDay.dateLabel}`
              : "Selecione um dia"}
          </h3>
          <div className="mt-4 grid gap-3">
            {dayState === "loading" ? (
              <p
                className="text-sm font-medium leading-6 text-tesText-muted"
                role="status"
              >
                Carregando horários…
              </p>
            ) : null}
            {dayState === "error" ? (
              <p
                className="text-sm font-medium leading-6 text-tesText-muted"
                role="alert"
              >
                Esses horários mudaram. Escolha outro dia para continuar.
              </p>
            ) : null}
            {dayState === "idle" && selectedDay
              ? selectedDay.slots.map((slot) => (
                  <TrackedBookingLink
                    className="rounded-[10px] bg-white px-4 py-3 text-center text-sm font-bold text-brand-primary shadow-sm outline-none transition hover:bg-brand-primary hover:text-white focus-visible:ring-4 focus-visible:ring-brand-primary/20"
                    href={buildPublicReservationUrl({
                      durationMinutes: service.durationMinutes,
                      priceCents: service.priceCents,
                      serviceId: slot.serviceId,
                      slotStartsAt: slot.startsAt,
                      therapistSlug,
                    })}
                    key={`${slot.serviceId}-${slot.startsAt}`}
                    serviceId={slot.serviceId}
                    therapistSlug={therapistSlug}
                  >
                    {slot.timeLabel}
                  </TrackedBookingLink>
                ))
              : null}
            {dayState === "idle" && !selectedDay ? (
              <p className="text-sm font-medium leading-6 text-tesText-muted">
                Os dias com horários aparecem destacados no calendário.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </TESDialog>
  );
}
