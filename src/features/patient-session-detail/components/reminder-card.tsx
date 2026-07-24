import { Bell } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function ReminderCard({
  booking,
}: {
  booking: PatientSessionDetailPageData["booking"];
}) {
  const minutes = booking.minutesUntilStart;

  return (
    <section className="rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Bell aria-hidden="true" size={24} />
        </span>
        <h2 className="font-display text-2xl font-light italic text-brand-deep">
          Lembrete
        </h2>
      </div>
      <p className="mt-8 text-sm font-semibold text-tesText-secondary">
        {minutes ? "Sua sessão começa em" : "Sua sessão está no horário"}
      </p>
      <p className="mt-3 text-5xl font-extrabold leading-none text-brand-deep">
        {minutes ?? "Agora"}
      </p>
      {minutes ? (
        <p className="mt-1 text-sm font-extrabold text-tesText-secondary">
          minutos
        </p>
      ) : null}
      <p className="mt-8 text-sm font-semibold leading-6 text-tesText-secondary">
        Entrar alguns minutos antes ajuda a preparar seu encontro.
      </p>
    </section>
  );
}
