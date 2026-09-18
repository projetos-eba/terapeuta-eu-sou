"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PatientSessionFeedbackDialog } from "@/features/session-feedback";
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

  useEffect(() => {
    setRefreshedPayload(null);
  }, [initialPayload]);

  useEffect(() => {
    setDialogOpen(feedbackOpen);
  }, [feedbackOpen]);

  return (
    <>
      <SessionQualityStatus actorRole="patient" payload={refreshedPayload ?? initialPayload} />
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
    </>
  );
}
