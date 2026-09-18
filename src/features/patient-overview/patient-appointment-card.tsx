"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, Clock3 } from "lucide-react";

import { EncounterStatusBadge } from "@/features/patient-encounters/components/encounter-status-badge";
import { routes } from "@/lib/routes";

import { EncounterActionsMenu } from "../patient-encounters/components/encounter-actions-menu";
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
    <article className="relative grid gap-4 rounded-md border border-[var(--tes-color-border)] bg-[#fdfbff] p-3 sm:grid-cols-[52px_minmax(0,1fr)_auto_minmax(135px,auto)_minmax(145px,auto)] sm:items-center">
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
      <div className="flex flex-wrap items-center gap-2 sm:justify-self-start">
        <EncounterStatusBadge
          className="min-h-7 text-[11px] font-medium whitespace-nowrap"
          status={appointment.status}
        >
          {appointment.statusLabel}
        </EncounterStatusBadge>
      </div>
      <dl className="grid gap-2 text-xs text-[var(--tes-color-text-secondary-app)] sm:block">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4 text-black" />
          <dt className="sr-only">Data</dt>
          <dd>
            {formatAppointmentDate(appointment.startsAt, appointment.timezone)}
          </dd>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Clock3 aria-hidden="true" className="size-4 text-black" />
          <dt className="sr-only">Horário</dt>
          <dd>
            {formatTimeRange(
              appointment.startsAt,
              appointment.endsAt,
              appointment.timezone,
            )}
          </dd>
        </div>
      </dl>
      <div className="flex items-center justify-center gap-2 sm:justify-self-end">
        {isLive ? (
          <Link
            className="inline-flex min-h-10 w-[145px] items-center justify-center rounded-sm bg-brand-primary px-4 text-xs font-medium text-white outline-none transition hover:bg-brand-primaryHover focus-visible:ring-4 focus-visible:ring-ring/20"
            href={
              routes.patient.encounterDetail(appointment.id) as Route<string>
            }
          >
            Entrar no encontro
          </Link>
        ) : (
          <Link
            className="inline-flex min-h-9 w-full items-center justify-center rounded-sm border border-[var(--tes-color-border)] bg-white px-4 text-xs font-medium text-[var(--tes-color-primary-dark)] outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20 sm:w-[145px]"
            href={
              routes.patient.encounterDetail(appointment.id) as Route<string>
            }
          >
            Ver detalhes
          </Link>
        )}
        <EncounterActionsMenu
          bookingId={appointment.id}
          className="relative shrink-0"
        />
      </div>
    </article>
  );
}
