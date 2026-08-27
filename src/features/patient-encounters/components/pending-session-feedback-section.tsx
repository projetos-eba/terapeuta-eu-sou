"use client";

import Image from "next/image";
import { CheckCircle2, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TESButton } from "@/components/tes";
import { PatientSessionFeedbackDialog } from "@/features/session-feedback";

import type { PatientPendingFeedbackSession } from "../patient-encounters.types";

export function PendingSessionFeedbackSection({
  initialBookingId,
  sessions: initialSessions,
}: {
  initialBookingId?: string | null;
  sessions: PatientPendingFeedbackSession[];
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialSessions.some((session) => session.bookingId === initialBookingId)
      ? (initialBookingId ?? null)
      : null,
  );
  const selected = useMemo(
    () => sessions.find((session) => session.bookingId === selectedId) ?? null,
    [selectedId, sessions],
  );

  useEffect(() => {
    if (
      initialBookingId &&
      initialSessions.some((session) => session.bookingId === initialBookingId)
    ) {
      setSelectedId(initialBookingId);
    }
  }, [initialBookingId, initialSessions]);

  if (sessions.length === 0) return null;

  return (
    <section aria-labelledby="pending-feedback-title" className="rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="max-w-[720px]">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-lavenderSoft px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-brand-primary">
          <CheckCircle2 aria-hidden="true" size={16} />
          Ação necessária
        </span>
        <h2 className="mt-3 font-display text-[1.8rem] font-light italic leading-tight text-brand-deep sm:text-[2.1rem]" id="pending-feedback-title">
          Encontros aguardando sua confirmação
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Confirme cada encontro separadamente. A confirmação privada é diferente da avaliação pública do terapeuta.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        {sessions.map((session) => {
          const labels = formatSessionDate(session.startsAt, session.timezone);
          return (
            <article className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={session.bookingId}>
              <div className="flex min-w-0 items-center gap-3">
                {session.therapist.avatarUrl ? (
                  <Image alt="" className="size-12 shrink-0 rounded-full object-cover" height={48} src={session.therapist.avatarUrl} width={48} />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft font-extrabold text-brand-primary">
                    {session.therapist.name.charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-extrabold text-brand-deep">{session.therapist.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-tesText-secondary">{session.serviceLabel} · {session.therapyLabel}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-tesText-muted">
                    <Clock3 aria-hidden="true" size={15} />
                    {labels.dateLabel}, {labels.timeLabel}
                  </p>
                  <p className="mt-2 text-xs font-extrabold text-status-warning">{confirmationLabel(session.confirmationState)}</p>
                </div>
              </div>
              <TESButton className="w-full sm:w-auto" onClick={() => setSelectedId(session.bookingId)} type="button" variant="gradient">
                Confirmar encontro
              </TESButton>
            </article>
          );
        })}
      </div>

      {selected ? (
        <PatientSessionFeedbackDialog
          onClose={() => {
            setSelectedId(null);
            if (submittedId) {
              setSessions((current) => current.filter((session) => session.bookingId !== submittedId));
              setSubmittedId(null);
            }
          }}
          onSessionSubmitted={() => setSubmittedId(selected.bookingId)}
          session={{
            bookingId: selected.bookingId,
            dateLabel: formatSessionDate(selected.startsAt, selected.timezone).dateLabel,
            serviceLabel: selected.serviceLabel,
            therapist: { id: selected.therapist.id, name: selected.therapist.name },
            timeLabel: formatSessionDate(selected.startsAt, selected.timezone).timeLabel,
          }}
        />
      ) : null}
    </section>
  );
}

function confirmationLabel(state: PatientPendingFeedbackSession["confirmationState"]) {
  const labels: Record<PatientPendingFeedbackSession["confirmationState"], string> = {
    awaiting_both: "Aguardando paciente e terapeuta",
    awaiting_patient: "Aguardando sua confirmação",
    awaiting_therapist: "Aguardando confirmação do terapeuta",
    blocked_for_review: "Bloqueada para análise",
    completed: "Concluída",
    next_batch: "Próximo lote",
    safety_period: "Período de segurança de 24 horas",
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
