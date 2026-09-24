"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

import { buildPublicReservationUrl } from "@/features/booking/services/public-booking";
import { TrackedBookingLink } from "@/features/public-metrics";

import type { AvailabilityDay, TherapistProfileService } from "../types";
import { AvailabilityCalendarModal } from "./availability-calendar-modal";

type AvailabilitySelectorProps = {
  services: TherapistProfileService[];
  therapistSlug: string;
};

type CompactAvailability = {
  days: AvailabilityDay[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

function readCompactAvailability(value: unknown): CompactAvailability | null {
  if (
    !isRecord(value) ||
    value.type !== "compact" ||
    !isRecord(value.availability) ||
    !Array.isArray(value.availability.days)
  ) {
    return null;
  }

  return { days: value.availability.days.filter(isAvailabilityDay) };
}

export function AvailabilitySelector({
  staticPreview = false,
  services,
  therapistSlug,
}: AvailabilitySelectorProps & { staticPreview?: boolean }) {
  const [selectedServiceId, setSelectedServiceId] = useState(
    services[0]?.id ?? "",
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [liveDaysByService, setLiveDaysByService] = useState<
    Record<string, AvailabilityDay[]>
  >({});
  const [unavailableServiceIds, setUnavailableServiceIds] = useState<string[]>(
    [],
  );
  const activeRequest = useRef<AbortController | null>(null);
  const selectedInteractiveService = useMemo(
    () =>
      services.find((service) => service.id === selectedServiceId) ??
      services[0],
    [selectedServiceId, services],
  );
  const selectedService = staticPreview
    ? services[0]
    : selectedInteractiveService;
  const refreshServiceAvailability = useCallback(async (serviceId: string) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      const response = await fetch(
        `/api/public/service-availability?service=${encodeURIComponent(serviceId)}&compact=1`,
        { cache: "no-store", signal: controller.signal },
      );
      const availability = response.ok
        ? readCompactAvailability(await response.json())
        : null;
      if (!availability || controller.signal.aborted) {
        if (!controller.signal.aborted) {
          setUnavailableServiceIds((current) =>
            current.includes(serviceId) ? current : [...current, serviceId],
          );
        }
        return;
      }

      setLiveDaysByService((current) => ({
        ...current,
        [serviceId]: availability.days,
      }));
      setUnavailableServiceIds((current) =>
        current.filter((id) => id !== serviceId),
      );
    } catch {
      if (!controller.signal.aborted) {
        setUnavailableServiceIds((current) =>
          current.includes(serviceId) ? current : [...current, serviceId],
        );
      }
    }
  }, []);

  useEffect(() => {
    if (staticPreview || !selectedService) return;

    const refresh = () => {
      void refreshServiceAvailability(selectedService.id);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      activeRequest.current?.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshServiceAvailability, selectedService, staticPreview]);

  const isAvailabilityUnavailable = Boolean(
    selectedService && unavailableServiceIds.includes(selectedService.id),
  );
  const days = isAvailabilityUnavailable
    ? []
    : (selectedService && liveDaysByService[selectedService.id]) ??
      selectedService?.availability ??
      [];
  const compactDays = days.slice(0, 3);

  function openCalendar() {
    if (!selectedService) return;
    void refreshServiceAvailability(selectedService.id);
    setIsCalendarOpen(true);
  }

  return (
    <section className="max-h-none overflow-visible rounded-[22px] bg-brand-primary p-6 text-white sm:p-8 lg:max-h-[620px] lg:overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-5">
          <CalendarDays className="size-8" />
          <div>
            <h2 className="font-display text-2xl font-light italic">
              Próximos horários disponíveis
            </h2>
            {selectedService ? (
              <p className="mt-1 text-sm font-medium leading-6 text-white/80">
                {selectedService.title} ·{" "}
                até {selectedService.durationMinutes} min ·{" "}
                {selectedService.priceLabel}
              </p>
            ) : null}
          </div>
        </div>

        {services.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {services.map((service) => {
              const className =
                service.id === selectedService?.id
                  ? "min-h-11 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-primary"
                  : "min-h-11 rounded-full border border-white/30 px-4 py-2 text-sm font-bold text-white";

              return staticPreview ? (
                <span className={className} key={service.id}>
                  {service.title}
                </span>
              ) : (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  className={className}
                >
                  {service.title}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-7 space-y-4">
        {compactDays.length ? (
          compactDays.map((day) => (
            <div
              key={`${selectedService?.id}-${day.date}`}
              className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 sm:gap-5"
            >
              <div className="text-sm font-medium leading-5">
                <p>{day.dayLabel}</p>
                <p>{day.dateLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-3">
                {day.slots.slice(0, 5).map((slot, index) => {
                  const className = `min-w-0 rounded-[9px] bg-brand-primaryPressed px-2 py-3 text-center text-sm font-medium sm:px-4 ${index >= 4 ? "hidden sm:inline-flex" : "inline-flex"}`;

                  return staticPreview ? (
                    <span
                      className={className}
                      key={`${slot.serviceId}-${slot.startsAt}`}
                    >
                      {slot.timeLabel}
                    </span>
                  ) : (
                    <TrackedBookingLink
                      key={`${slot.serviceId}-${slot.startsAt}`}
                      href={buildPublicReservationUrl({
                        durationMinutes: selectedService?.durationMinutes ?? 50,
                        priceCents: selectedService?.priceCents ?? 0,
                        serviceId: slot.serviceId,
                        slotStartsAt: slot.startsAt,
                        therapistSlug,
                      })}
                      serviceId={slot.serviceId}
                      therapistSlug={therapistSlug}
                      className={className}
                    >
                      {slot.timeLabel}
                    </TrackedBookingLink>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[14px] bg-brand-primaryPressed px-5 py-4 text-sm font-medium">
            {isAvailabilityUnavailable
              ? "Não foi possível atualizar os horários agora. Tente abrir a agenda completa novamente."
              : "Agenda temporariamente indisponível para esta terapia."}
          </div>
        )}
      </div>

      {staticPreview ? (
        <span className="mx-auto mt-8 block w-fit text-base font-medium">
          Ver agenda completa e mais horários →
        </span>
      ) : (
        <button
          className="mx-auto mt-8 block w-fit text-base font-medium outline-none transition hover:text-white/80 focus-visible:ring-4 focus-visible:ring-white/20"
          disabled={
            !selectedService ||
            (days.length === 0 && !isAvailabilityUnavailable)
          }
          onClick={openCalendar}
          type="button"
        >
          Ver agenda completa e mais horários →
        </button>
      )}

      {!staticPreview && isCalendarOpen && selectedService ? (
        <AvailabilityCalendarModal
          initialDays={days}
          onClose={() => {
            setIsCalendarOpen(false);
            void refreshServiceAvailability(selectedService.id);
          }}
          service={{ ...selectedService, availability: days }}
          therapistSlug={therapistSlug}
        />
      ) : null}
    </section>
  );
}
