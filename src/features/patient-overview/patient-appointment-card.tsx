import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, Clock3, EllipsisVertical } from "lucide-react";

import { routes } from "@/lib/routes";

import {
  formatAppointmentDate,
  formatTimeRange,
} from "./patient-overview.formatters";
import type { PatientAppointment } from "./patient-overview.types";

export function PatientAppointmentCard({
  appointment,
}: {
  appointment: PatientAppointment;
}) {
  const isLive = appointment.status === "live";

  return (
    <article className="grid gap-4 rounded-md border border-[var(--tes-color-border)] bg-[#fdfbff] p-3 sm:grid-cols-[52px_minmax(150px,1fr)_minmax(135px,auto)_minmax(145px,auto)_20px] sm:items-center">
      <span className="relative inline-flex size-[52px] overflow-hidden rounded-full bg-brand-lavenderSoft">
        {appointment.professional.avatarUrl ? (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="52px"
            src={appointment.professional.avatarUrl}
          />
        ) : null}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[var(--tes-color-primary-dark)]">
          {appointment.professional.name}
        </h3>
        <p className="mt-1 text-xs text-[var(--tes-color-text-secondary-app)]">
          {appointment.serviceLabel}
        </p>
        <p className="text-xs text-[var(--tes-color-text-secondary-app)]">
          {appointment.therapyLabel}
        </p>
      </div>
      <dl className="grid gap-2 text-xs text-[var(--tes-color-text-secondary-app)] sm:block">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4 text-black" />
          <dt className="sr-only">Data</dt>
          <dd>{formatAppointmentDate(appointment.startsAt)}</dd>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Clock3 aria-hidden="true" className="size-4 text-black" />
          <dt className="sr-only">Horário</dt>
          <dd>{formatTimeRange(appointment.startsAt, appointment.endsAt)}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 sm:items-end">
        <span
          className={`inline-flex min-h-7 items-center rounded-full px-3 text-[11px] font-medium ${isLive ? "bg-[#fdebf2] text-[#ef5b7a]" : "bg-status-successBg text-status-success"}`}
        >
          {isLive ? "Ao vivo agora" : "Confirmada"}
        </span>
        {isLive && appointment.meetingUrl ? (
          <>
            <a
              className="inline-flex min-h-8 w-full items-center justify-center rounded-sm bg-brand-primary px-4 text-xs font-medium text-white outline-none transition hover:bg-brand-primaryHover focus-visible:ring-4 focus-visible:ring-ring/20 sm:w-[145px]"
              href={appointment.meetingUrl}
            >
              Entrar na sessão
            </a>
            <Link
              className="inline-flex min-h-8 w-full items-center justify-center rounded-sm border border-[var(--tes-color-border)] bg-white px-4 text-xs font-medium text-brand-primary outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20 sm:w-[145px]"
              href={routes.patient.messages as Route<string>}
            >
              Enviar mensagem
            </Link>
          </>
        ) : (
          <Link
            className="inline-flex min-h-9 w-full items-center justify-center rounded-sm border border-[var(--tes-color-border)] bg-white px-4 text-xs font-medium text-[var(--tes-color-primary-dark)] outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20 sm:w-[145px]"
            href={routes.patient.sessions as Route<string>}
          >
            Ver detalhes
          </Link>
        )}
      </div>
      <button
        aria-label={`Mais opções para a sessão com ${appointment.professional.name}`}
        className="inline-flex size-8 items-center justify-center self-start rounded-sm text-brand-primary outline-none hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20 sm:self-center"
        type="button"
      >
        <EllipsisVertical aria-hidden="true" className="size-4" />
      </button>
    </article>
  );
}
