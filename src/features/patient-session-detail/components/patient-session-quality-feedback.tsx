"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { TESButton, TESDialog } from "@/components/tes";
import {
  PatientPublicReviewForm,
  PatientSessionFeedbackDialog,
} from "@/features/session-feedback";
import type { PatientFeedbackSession } from "@/features/session-feedback/components/patient-session-feedback-dialog";
import { SessionQualityStatus } from "@/features/session-feedback/components/session-quality-status";
import type { SessionFeedbackReadPayload } from "@/features/session-feedback/session-feedback.types";

export function PatientSessionQualityFeedback({
  feedbackOpen,
  initialPayload,
  session,
}: {
  feedbackOpen: boolean;
  initialPayload?: SessionFeedbackReadPayload;
  session: PatientFeedbackSession;
}) {
  const router = useRouter();
  const [refreshedPayload, setRefreshedPayload] = useState<SessionFeedbackReadPayload | null>(null);
  const [dialogOpen, setDialogOpen] = useState(feedbackOpen);
  const [publicReviewOpen, setPublicReviewOpen] = useState(false);

  useEffect(() => {
    setRefreshedPayload(null);
  }, [initialPayload]);

  useEffect(() => {
    setDialogOpen(feedbackOpen);
  }, [feedbackOpen]);

  const payload = refreshedPayload ?? initialPayload;
  const canReviewTherapist =
    payload?.realizationStatus === "performed" &&
    payload.feedback?.successful === true;

  return (
    <>
      <SessionQualityStatus actorRole="patient" payload={payload} />
      {dialogOpen && initialPayload?.status === "eligible" ? (
        <PatientSessionFeedbackDialog
          onClose={() => {
            setDialogOpen(false);
            router.refresh();
          }}
          onSessionSubmitted={(payload) => {
            if (payload) setRefreshedPayload(payload);
          }}
          session={session}
        />
      ) : null}
      {canReviewTherapist ? (
        <section className="rounded-card border border-brand-lavender bg-white p-5">
          <h2 className="text-base font-extrabold text-brand-deep">
            Avalie seu terapeuta
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Se desejar, compartilhe uma avaliação pública sobre sua experiência.
          </p>
          <TESButton
            className="mt-4"
            onClick={() => setPublicReviewOpen(true)}
            type="button"
            variant="secondary"
          >
            Avaliar terapeuta
          </TESButton>
        </section>
      ) : null}
      {publicReviewOpen ? (
        <TESDialog
          description="Esta etapa é opcional e não altera o atendimento nem os pagamentos."
          onClose={() => setPublicReviewOpen(false)}
          title="Avaliação pública opcional"
        >
          <PatientPublicReviewForm
            therapistName={session.therapist.name}
            therapistProfileId={session.therapist.id}
          />
        </TESDialog>
      ) : null}
    </>
  );
}
