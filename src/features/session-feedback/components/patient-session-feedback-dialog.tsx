"use client";

import { useState } from "react";

import { TESButton, TESDialog } from "@/components/tes";

import type { SessionFeedbackRecord } from "../session-feedback.types";
import { PatientPublicReviewForm } from "./patient-public-review-form";
import { SessionFeedbackForm } from "./session-feedback-form";

export type PatientFeedbackSession = {
  bookingId: string;
  dateLabel: string;
  serviceLabel: string;
  therapist: {
    id: string;
    name: string;
  };
  timeLabel: string;
};

export function PatientSessionFeedbackDialog({
  onClose,
  onSessionSubmitted,
  session,
}: {
  onClose: () => void;
  onSessionSubmitted?: () => void;
  session: PatientFeedbackSession;
}) {
  const [step, setStep] = useState<"session" | "public-review">("session");
  const [completedFeedback, setCompletedFeedback] = useState(false);

  return (
    <TESDialog
      className="max-w-[820px]"
      description={`${session.therapist.name} · ${session.dateLabel}, ${session.timeLabel}`}
      onClose={onClose}
      title={step === "session" ? "Confirme seu encontro" : "Avaliação pública opcional"}
    >
      {step === "session" ? (
        <div className="grid gap-4">
          <SessionFeedbackForm
            actorRole="patient"
            bookingId={session.bookingId}
            introductoryMessage={`${session.serviceLabel} com ${session.therapist.name}`}
            onSubmitted={(feedback: SessionFeedbackRecord) => {
              setCompletedFeedback(feedback.outcome === "completed");
              onSessionSubmitted?.();
            }}
            sessionLabel={`${session.dateLabel} · ${session.timeLabel}`}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {completedFeedback ? (
              <TESButton onClick={onClose} type="button" variant="secondary">
                Concluir agora
              </TESButton>
            ) : null}
            <TESButton onClick={() => setStep("public-review")} type="button" variant="secondary">
              Avaliar terapeuta (opcional)
            </TESButton>
          </div>
        </div>
      ) : (
        <PatientPublicReviewForm
          therapistName={session.therapist.name}
          therapistProfileId={session.therapist.id}
        />
      )}
    </TESDialog>
  );
}
