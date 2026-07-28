"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CalendarDays } from "lucide-react";

import { routes } from "@/lib/routes";

import type { TherapistProfileService } from "../types";
import { AvailabilityCalendarModal } from "./availability-calendar-modal";

type AvailabilitySelectorProps = {
  services: TherapistProfileService[];
};

export function AvailabilitySelector({ services }: AvailabilitySelectorProps) {
  const [selectedServiceId, setSelectedServiceId] = useState(
    services[0]?.id ?? "",
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const selectedService = useMemo(
    () =>
      services.find((service) => service.id === selectedServiceId) ??
      services[0],
    [selectedServiceId, services],
  );
  const days = selectedService?.availability ?? [];
  const compactDays = days.slice(0, 3);

  return (
    <section className="rounded-[22px] bg-brand-primary p-8 text-white">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-5">
          <CalendarDays className="size-8" />
          <div>
            <h2 className="font-display text-2xl font-light italic">
              Próximos horários disponíveis
            </h2>
            {selectedService ? (
              <p className="mt-1 text-sm font-medium leading-6 text-white/80">
                {selectedService.title} · {selectedService.durationMinutes} min
                · {selectedService.priceLabel}
              </p>
            ) : null}
          </div>
        </div>

        {services.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setSelectedServiceId(service.id)}
                className={
                  service.id === selectedService?.id
                    ? "min-h-11 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-primary"
                    : "min-h-11 rounded-full border border-white/30 px-4 py-2 text-sm font-bold text-white"
                }
              >
                {service.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-7 space-y-4">
        {compactDays.length ? (
          compactDays.map((day) => (
            <div
              key={`${selectedService?.id}-${day.date}`}
              className="grid grid-cols-[72px_1fr] gap-5"
            >
              <div className="text-sm font-medium leading-5">
                <p>{day.dayLabel}</p>
                <p>{day.dateLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {day.slots.slice(0, 5).map((slot) => (
                  <Link
                    key={`${slot.serviceId}-${slot.startsAt}`}
                    href={
                      `${routes.public.reservation}?service=${slot.serviceId}&slot=${encodeURIComponent(
                        slot.startsAt,
                      )}` as Route
                    }
                    className="rounded-[9px] bg-brand-primaryPressed px-4 py-3 text-center text-sm font-medium"
                  >
                    {slot.timeLabel}
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[14px] bg-brand-primaryPressed px-5 py-4 text-sm font-medium">
            Agenda temporariamente indisponível para este serviço.
          </div>
        )}
      </div>

      <button
        className="mx-auto mt-8 block w-fit text-base font-medium outline-none transition hover:text-white/80 focus-visible:ring-4 focus-visible:ring-white/20"
        disabled={!selectedService || days.length === 0}
        onClick={() => setIsCalendarOpen(true)}
        type="button"
      >
        Ver agenda completa e mais horários →
      </button>

      {isCalendarOpen && selectedService ? (
        <AvailabilityCalendarModal
          days={days}
          onClose={() => setIsCalendarOpen(false)}
          service={selectedService}
        />
      ) : null}
    </section>
  );
}
