import Image from "next/image";
import { Bell } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function ReminderCard({
  booking,
}: {
  booking: PatientSessionDetailPageData["booking"];
}) {
  const minutes = booking.minutesUntilStart;

  return (
    <section className="relative overflow-hidden rounded-card border border-border bg-white p-5 shadow-card sm:p-6">
      <div className="relative z-10 flex items-center gap-3">
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

      <div className="relative z-10 mt-5 rounded-panel bg-brand-lavenderSoft px-4 py-5">
        <p className="text-sm font-semibold text-tesText-secondary">
          {minutes
            ? "Seu encontro começa em"
            : "Seu encontro está disponível agora"}
        </p>
        <p className="mt-2 text-4xl font-extrabold leading-none text-brand-deep">
          {minutes ?? "Agora"}
        </p>
        {minutes ? (
          <p className="mt-1 text-sm font-extrabold text-tesText-secondary">
            minutos
          </p>
        ) : null}
      </div>

      <p className="relative z-10 mt-4 max-w-[17rem] text-sm font-semibold leading-6 text-tesText-secondary">
        Entrar alguns minutos antes costuma ajudar a ajustar câmera, áudio e
        conexão com mais calma.
      </p>
      <Image
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -right-16 w-52 opacity-35"
        height={1254}
        src="/patient/encounters/lotus-detail.png"
        width={1254}
      />
    </section>
  );
}
