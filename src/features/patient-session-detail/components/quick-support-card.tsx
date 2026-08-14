import Link from "next/link";
import type { Route } from "next";
import { Bell, Headphones } from "lucide-react";

import { routes } from "@/lib/routes";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function QuickSupportCard({
  booking,
  bookingId,
  encounterState,
}: {
  booking: PatientSessionDetailPageData["booking"];
  bookingId: string;
  encounterState: PatientSessionDetailPageData["encounterState"];
}) {
  const showCountdown = typeof booking.minutesUntilStart === "number";

  return (
    <section className="rounded-[28px] border border-border bg-surface-soft px-5 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-white text-brand-primary">
          <Headphones aria-hidden="true" size={20} />
        </span>
        <h2 className="font-display text-[1.75rem] font-light italic leading-none text-brand-deep">
          Suporte rápido
        </h2>
      </div>
      <p className="mt-5 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
        Se algo não sair como esperado, fale com o suporte pelo seu fluxo
        autenticado e envie a referência deste encontro.
      </p>
      {showCountdown ? (
        <div className="mt-5 rounded-[22px] bg-white/90 px-4 py-4">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted sm:text-xs">
            <Bell aria-hidden="true" className="text-brand-primary" size={16} />
            Lembrete
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
            {booking.minutesUntilStart
              ? `Seu encontro começa em ${booking.minutesUntilStart} minuto${booking.minutesUntilStart > 1 ? "s" : ""}.`
              : encounterState.waitingRoom.message}
          </p>
        </div>
      ) : null}
      <Link
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={
          `${routes.patient.messages}?context=suporte&booking=${bookingId}` as Route<string>
        }
      >
        Falar com suporte
      </Link>
    </section>
  );
}
