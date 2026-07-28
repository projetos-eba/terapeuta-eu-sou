import Link from "next/link";
import type { Route } from "next";
import { Plus } from "lucide-react";

import { routes } from "@/lib/routes";

import { PatientAppointmentCard } from "./patient-appointment-card";
import type { PatientAppointment } from "./patient-overview.types";

export function PatientAgendaSection({
  appointments,
}: {
  appointments: PatientAppointment[];
}) {
  return (
    <section
      aria-labelledby="patient-agenda-title"
      className="rounded-[var(--tes-radius-auth-card)] border border-[var(--tes-color-border)]/40 bg-white p-5 shadow-[var(--tes-shadow-auth-card)]"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id="patient-agenda-title"
          className="font-display text-[25px] font-light italic text-[var(--tes-color-primary-dark)]"
        >
          Minha agenda
        </h2>
        <Link
          className="text-xs font-medium text-brand-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/20"
          href={routes.patient.encounters as Route<string>}
        >
          Ver agenda completa <span aria-hidden="true">→</span>
        </Link>
      </div>
      {appointments.length > 0 ? (
        <div className="mt-3 space-y-2">
          {appointments.map((appointment) => (
            <PatientAppointmentCard
              appointment={appointment}
              key={appointment.id}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-[var(--tes-color-border)] p-5 text-sm text-[var(--tes-color-text-secondary-app)]">
          Você ainda não tem encontros agendados.
        </p>
      )}
      <Link
        className="mt-3 flex min-h-[54px] items-center justify-center gap-4 rounded-md border border-dashed border-[var(--tes-color-border)] px-5 text-left outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.public.therapists as Route<string>}
      >
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Plus aria-hidden="true" className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-medium text-[var(--tes-color-primary-dark)]">
            Agendar nova consulta
          </span>
          <span className="mt-0.5 block text-xs text-[var(--tes-color-text-secondary-app)]">
            Encontre o terapeuta ideal para você
          </span>
        </span>
      </Link>
    </section>
  );
}
