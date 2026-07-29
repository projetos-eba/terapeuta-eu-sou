"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { TrackedBookingLink } from "@/features/public-metrics";
import { routes } from "@/lib/routes";

import type { AvailabilityDay, TherapistProfileService } from "../types";

type AvailabilityCalendarModalProps = {
  days: AvailabilityDay[];
  onClose: () => void;
  service: TherapistProfileService;
  therapistSlug: string;
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function getReservationHref(serviceId: string, startsAt: string) {
  return `${routes.public.reservation}?service=${serviceId}&slot=${encodeURIComponent(
    startsAt,
  )}`;
}

export function AvailabilityCalendarModal({
  days,
  onClose,
  service,
  therapistSlug,
}: AvailabilityCalendarModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const currentMonth = useMemo(() => getMonthStart(new Date()), []);
  const latestAvailableMonth = useMemo(() => {
    const latestDate = days[days.length - 1]?.date;
    return latestDate
      ? getMonthStart(new Date(`${latestDate}T00:00:00`))
      : currentMonth;
  }, [currentMonth, days]);
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const availableByDate = useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const calendarDates = useMemo(
    () => getCalendarDates(visibleMonth),
    [visibleMonth],
  );
  const visibleMonthKey = getMonthKey(visibleMonth);
  const selectedDay = selectedDate
    ? (availableByDate.get(selectedDate) ?? null)
    : null;
  const canGoPrevious = visibleMonth.getTime() > currentMonth.getTime();
  const canGoNext = visibleMonth.getTime() < latestAvailableMonth.getTime();

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const firstDayInMonth = days.find(
      (day) =>
        getMonthKey(new Date(`${day.date}T00:00:00`)) === visibleMonthKey,
    );
    const selectedDateIsVisible =
      selectedDate &&
      availableByDate.has(selectedDate) &&
      getMonthKey(new Date(`${selectedDate}T00:00:00`)) === visibleMonthKey;

    if (!selectedDateIsVisible) {
      setSelectedDate(firstDayInMonth?.date ?? null);
    }
  }, [availableByDate, days, selectedDate, visibleMonthKey]);

  function moveMonth(direction: -1 | 1) {
    setVisibleMonth((month) => {
      const next = new Date(month);
      next.setMonth(month.getMonth() + direction);
      return getMonthStart(next);
    });
  }

  return (
    <div
      aria-labelledby="availability-calendar-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="dialog"
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[22px] bg-white p-5 text-brand-deep shadow-2xl sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-primary">
              Agenda completa
            </p>
            <h2
              className="mt-2 font-display text-3xl font-light italic text-brand-deep"
              id="availability-calendar-title"
            >
              Escolha um dia e horário
            </h2>
            <p className="mt-2 text-sm font-medium text-tesText-muted">
              {service.title} · {service.durationMinutes} min ·{" "}
              {service.priceLabel}
            </p>
          </div>
          <button
            aria-label="Fechar agenda"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-brand-lavender text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-brand-primary/20"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <button
                aria-label="Mês anterior"
                className="grid size-10 place-items-center rounded-full border border-brand-lavender text-brand-primary outline-none transition enabled:hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-4 focus-visible:ring-brand-primary/20"
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
                className="grid size-10 place-items-center rounded-full border border-brand-lavender text-brand-primary outline-none transition enabled:hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-4 focus-visible:ring-brand-primary/20"
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
                const day = availableByDate.get(dateKey);
                const isCurrentMonth = getMonthKey(date) === visibleMonthKey;
                const isSelected = selectedDate === dateKey;
                const isAvailable = Boolean(day && isCurrentMonth);

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
                    disabled={!isAvailable}
                    key={dateKey}
                    onClick={() => setSelectedDate(dateKey)}
                    type="button"
                  >
                    <span
                      className={!isCurrentMonth ? "opacity-35" : undefined}
                    >
                      {date.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[18px] border border-brand-lavender bg-brand-lavenderSoft p-4">
            <h3 className="font-display text-2xl font-light italic text-brand-deep">
              {selectedDay
                ? `${selectedDay.dayLabel}, ${selectedDay.dateLabel}`
                : "Selecione um dia"}
            </h3>
            <div className="mt-4 grid gap-3">
              {selectedDay ? (
                selectedDay.slots.map((slot) => (
                  <TrackedBookingLink
                    className="rounded-[10px] bg-white px-4 py-3 text-center text-sm font-bold text-brand-primary shadow-sm outline-none transition hover:bg-brand-primary hover:text-white focus-visible:ring-4 focus-visible:ring-brand-primary/20"
                    href={getReservationHref(slot.serviceId, slot.startsAt)}
                    key={`${slot.serviceId}-${slot.startsAt}`}
                    serviceId={slot.serviceId}
                    therapistSlug={therapistSlug}
                  >
                    {slot.timeLabel}
                  </TrackedBookingLink>
                ))
              ) : (
                <p className="text-sm font-medium leading-6 text-tesText-muted">
                  Os dias com horários aparecem destacados no calendário.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
