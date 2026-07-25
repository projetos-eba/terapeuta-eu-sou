import Link from "next/link";
import type { Route } from "next";
import { CircleHelp } from "lucide-react";

import { routes } from "@/lib/routes";

import { PatientSupportTicketCard } from "./patient-support-ticket-card";
import type { PatientSupportTicket } from "./patient-overview.types";

export function PatientSupportSection({
  tickets,
}: {
  tickets: PatientSupportTicket[];
}) {
  return (
    <section
      aria-labelledby="patient-support-title"
      className="flex min-h-[540px] flex-col rounded-[var(--tes-radius-auth-card)] border border-[var(--tes-color-border)]/40 bg-white p-5 shadow-[var(--tes-shadow-auth-card)]"
    >
      <div className="flex items-start justify-between gap-4">
        <h2
          id="patient-support-title"
          className="flex items-center gap-1 font-display text-[29px] font-light italic text-[var(--tes-color-primary-dark)]"
        >
          Suporte{" "}
          <CircleHelp
            aria-hidden="true"
            className="size-3 font-sans text-[var(--tes-color-text-secondary-app)]"
          />
        </h2>
        <Link
          className="text-xs font-medium text-brand-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/20"
          href={routes.patient.help as Route<string>}
        >
          Ver todos <span aria-hidden="true">→</span>
        </Link>
      </div>
      {tickets.length ? (
        <div className="mt-7 space-y-4">
          {tickets.map((ticket) => (
            <PatientSupportTicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      ) : (
        <p className="mt-7 rounded-md border border-dashed border-[var(--tes-color-border)] p-4 text-sm text-[var(--tes-color-text-secondary-app)]">
          Nenhum ticket aberto por aqui.
        </p>
      )}
      <Link
        className="mt-auto flex min-h-11 items-center justify-center rounded-sm bg-brand-lavenderSoft px-4 text-xs font-medium text-brand-primary outline-none transition hover:bg-brand-lavender focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.patient.help as Route<string>}
      >
        Abrir novo ticket
      </Link>
    </section>
  );
}
