"use client";

import Image from "next/image";
import { CalendarCheck2, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";

import { TESButton } from "@/components/tes";
import { PatientSessionFeedbackDialog } from "@/features/session-feedback";

import type { PendingPatientReview } from "./patient-overview.types";

export function PatientReviewPrompt({
  review,
}: {
  review: PendingPatientReview | null;
}) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const labels = useMemo(
    () => (review ? formatSessionDate(review.startsAt, review.timezone) : null),
    [review],
  );

  if (!review || dismissed) return null;

  return (
    <>
      <section
        aria-labelledby="patient-review-title"
        className="relative overflow-hidden rounded-[var(--tes-radius-auth-card)] border border-[var(--tes-color-border)]/40 bg-white p-5 shadow-[var(--tes-shadow-auth-card)]"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-lavenderSoft px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-brand-primary">
          <CalendarCheck2 aria-hidden="true" size={16} />
          Confirmação pendente
        </span>
        <h2
          id="patient-review-title"
          className="mt-3 font-display text-[26px] font-light italic leading-tight text-[var(--tes-color-primary-dark)]"
        >
          Como foi seu encontro?
        </h2>
        <div className="mt-4 flex items-start gap-3">
          <span className="relative inline-flex size-12 shrink-0 overflow-hidden rounded-full bg-brand-lavenderSoft">
            {review.professional.avatarUrl ? (
              <Image alt="" className="object-cover" fill sizes="48px" src={review.professional.avatarUrl} />
            ) : null}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-[var(--tes-color-primary-dark)]">
              {review.professional.name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-[var(--tes-color-text-secondary-app)]">
              {review.serviceLabel} · {review.therapyLabel}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-tesText-muted">
              <Clock3 aria-hidden="true" size={16} />
              {labels?.dateLabel}, {labels?.timeLabel}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold leading-6 text-[var(--tes-color-text-secondary-app)]">
          Confirme se o encontro aconteceu. Sua resposta privada é separada da avaliação pública do terapeuta.
        </p>
        <TESButton className="mt-4 w-full" onClick={() => setOpen(true)} type="button" variant="gradient">
          Confirmar encontro
        </TESButton>
      </section>

      {open && labels ? (
        <PatientSessionFeedbackDialog
          onClose={() => {
            setOpen(false);
            if (submitted) setDismissed(true);
          }}
          onSessionSubmitted={() => setSubmitted(true)}
          session={{
            bookingId: review.appointmentId,
            dateLabel: labels.dateLabel,
            serviceLabel: review.serviceLabel,
            therapist: { id: review.professional.id, name: review.professional.name },
            timeLabel: labels.timeLabel,
          }}
        />
      ) : null}
    </>
  );
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
