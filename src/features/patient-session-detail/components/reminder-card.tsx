import { Bell, CalendarDays, Clock3 } from "lucide-react";

import { BookingStatus } from "@/domain/tes";
import { formatBookingReminderSchedule } from "@/features/bookings/booking-formatters";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function ReminderCard({
  booking,
}: {
  booking: PatientSessionDetailPageData["booking"];
}) {
  const minutes = booking.minutesUntilStart;

  if (isTerminalBookingStatus(booking.status)) return null;

  const scheduleLabel = formatBookingReminderSchedule(
    booking.startsAt,
    booking.timezone,
  );

  return (
    <section className="w-full min-w-0 rounded-card border border-border bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Bell aria-hidden="true" size={20} />
        </span>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
            Lembrete
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-brand-deep sm:text-xl">
            {minutes
              ? "Seu encontro se aproxima"
              : "Seu encontro está no horário"}
          </h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-panel bg-brand-lavenderSoft px-4 py-5">
        <p className="flex items-center gap-3 font-display text-2xl font-light italic leading-tight text-brand-deep">
          <CalendarDays
            aria-hidden="true"
            className="shrink-0 text-brand-primary"
            size={25}
          />
          {scheduleLabel}
        </p>
        <p className="flex items-center gap-3 border-t border-brand-lavender/70 pt-3 font-display text-xl font-light italic leading-tight text-brand-deep">
          <Clock3
            aria-hidden="true"
            className="shrink-0 text-brand-primary"
            size={23}
          />
          {formatTimeRemaining(minutes)}
        </p>
      </div>

      <p className="mt-4 max-w-[17rem] text-sm font-semibold leading-6 text-tesText-secondary">
        Entrar alguns minutos antes costuma ajudar a ajustar câmera, áudio e
        conexão com mais calma.
      </p>
    </section>
  );
}

function formatTimeRemaining(minutes: number | null) {
  if (!minutes) return "Disponível agora";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const duration = hours
    ? `${hours}h${remainingMinutes ? String(remainingMinutes).padStart(2, "0") : ""}`
    : `${remainingMinutes} min`;

  return hours === 1 && remainingMinutes === 0
    ? `Falta ${duration}`
    : `Faltam ${duration}`;
}

function isTerminalBookingStatus(status: string) {
  return (
    status === BookingStatus.Completed ||
    status === BookingStatus.CancelledByPatient ||
    status === BookingStatus.CancelledByTherapist ||
    status === BookingStatus.NoShowPatient ||
    status === BookingStatus.NoShowTherapist ||
    status === BookingStatus.CancelledByPayment ||
    status === BookingStatus.Refunded
  );
}
