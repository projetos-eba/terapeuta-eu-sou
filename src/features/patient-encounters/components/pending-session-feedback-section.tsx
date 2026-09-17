import Image from "next/image";
import { CheckCircle2, Clock3 } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

import type { PatientPendingFeedbackSession } from "../patient-encounters.types";

export function PendingSessionFeedbackSection({
  sessions,
}: {
  sessions: PatientPendingFeedbackSession[];
}) {
  if (sessions.length === 0) return null;

  return (
    <section
      aria-labelledby="pending-feedback-title"
      className="rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6"
    >
      <div className="max-w-[720px]">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-lavenderSoft px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-brand-primary">
          <CheckCircle2 aria-hidden="true" size={16} />
          Avaliação disponível
        </span>
        <h2
          className="mt-3 font-display text-[1.8rem] font-light italic leading-tight text-brand-deep sm:text-[2.1rem]"
          id="pending-feedback-title"
        >
          Encontros aguardando sua avaliação
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Avalie cada encontro separadamente. Sua resposta é privada e não
          interfere no pagamento nem no repasse; a avaliação pública do
          terapeuta é uma etapa diferente e opcional.
        </p>
      </div>

      <div
        aria-label="Lista de avaliações pendentes"
        className="mt-5 grid max-h-[34rem] grid-cols-1 gap-3 overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin] lg:max-h-[20rem] lg:grid-cols-2"
        data-testid="pending-feedback-scroll"
        role="region"
      >
        {sessions.map((session) => {
          const labels = formatSessionDate(session.startsAt, session.timezone);
          return (
            <article
              className="grid h-full gap-4 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={session.bookingId}
            >
              <div className="flex min-w-0 items-center gap-3">
                {session.therapist.avatarUrl ? (
                  <Image
                    alt=""
                    className="size-12 shrink-0 rounded-full object-cover"
                    height={48}
                    src={session.therapist.avatarUrl}
                    width={48}
                  />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft font-extrabold text-brand-primary">
                    {session.therapist.name.charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-extrabold text-brand-deep">
                    {session.therapist.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                    {session.serviceLabel} · {session.therapyLabel}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-tesText-muted">
                    <Clock3 aria-hidden="true" size={15} />
                    {labels.dateLabel}, {labels.timeLabel}
                  </p>
                  <p className="mt-2 text-xs font-extrabold text-status-warning">
                    {confirmationLabel(session.confirmationState)}
                  </p>
                </div>
              </div>
              <TESButton
                className="w-full sm:w-auto"
                href={`${routes.patient.encounterDetail(session.bookingId)}?feedback=1`}
                variant="gradient"
              >
                Ver detalhes do encontro
              </TESButton>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function confirmationLabel(
  state: PatientPendingFeedbackSession["confirmationState"],
) {
  const labels: Record<
    PatientPendingFeedbackSession["confirmationState"],
    string
  > = {
    awaiting_both: "Aguardando avaliações",
    awaiting_patient: "Aguardando sua avaliação",
    awaiting_therapist: "Aguardando avaliação do terapeuta",
    blocked_for_review: "Bloqueada para análise",
    completed: "Avaliações concluídas",
    next_batch: "Próximo lote",
    processing_payment: "Pagamento em processamento",
    safety_period: "Pagamento em processamento",
  };
  return labels[state];
}

function formatSessionDate(value: string, timezone: string) {
  const date = new Date(value);
  return {
    dateLabel: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      timeZone: timezone,
      year: "numeric",
    }).format(date),
    timeLabel: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(date),
  };
}
