"use client";

import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { TESButton, TESDialog, TESFeedbackDialog } from "@/components/tes";

import type { TherapistReviewItem } from "../therapist-reviews.types";

export function ReviewReplyDialog({
  onClose,
  onSubmit,
  review,
}: {
  onClose: () => void;
  onSubmit: (
    review: TherapistReviewItem,
    body: string,
  ) => Promise<string | null>;
  review: TherapistReviewItem;
}) {
  const [body, setBody] = useState(review.reply?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    focusId?: string;
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const descriptionId = useMemo(
    () => `reply-${review.id}-description`,
    [review.id],
  );
  const trimmedBody = body.trim();
  const invalid = trimmedBody.length < 3 || trimmedBody.length > 600;

  async function submit() {
    if (invalid) {
      setError("Escreva uma resposta entre 3 e 600 caracteres.");
      setFeedback({
        focusId: "review-reply-body",
        message: "Escreva uma resposta entre 3 e 600 caracteres.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    const message = await onSubmit(review, trimmedBody);
    setSubmitting(false);

    if (message) {
      setError(message);
      setFeedback({ message });
    }
  }

  return (
    <TESDialog
      description="Sua resposta fica pública junto da avaliação. Escreva com acolhimento, sem prometer resultado ou discutir dados privados."
      onClose={onClose}
      title={review.reply ? "Resposta publicada" : "Responder avaliação"}
    >
      <div className="grid gap-5">
        <div className="rounded-card bg-brand-lavenderSoft/50 p-4">
          <p className="text-sm font-extrabold text-brand-deep">
            {review.patientName}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {review.comment}
          </p>
        </div>

        <div>
          <label
            className="text-sm font-extrabold text-brand-deep"
            htmlFor="review-reply-body"
          >
            Resposta
          </label>
          <p
            className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary"
            id={descriptionId}
          >
            A resposta deve ser breve, responsável e não incluir dados privados.
          </p>
          <textarea
            aria-describedby={descriptionId}
            className="mt-3 min-h-[160px] w-full rounded-card border border-brand-lavender px-4 py-3 text-sm font-bold leading-6 text-brand-deep outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
            id="review-reply-body"
            maxLength={600}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span aria-live="polite" className="sr-only">
              {error}
            </span>
            <p className="text-sm font-semibold text-tesText-muted">
              {trimmedBody.length}/600 caracteres
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <TESButton
            className="min-h-11 rounded-lg"
            disabled={submitting}
            onClick={onClose}
            type="button"
            variant="secondary"
          >
            Cancelar
          </TESButton>
          <TESButton
            className="min-h-11 rounded-lg"
            disabled={submitting}
            onClick={() => void submit()}
            type="button"
          >
            {submitting ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            ) : (
              <Send aria-hidden="true" size={18} />
            )}
            {review.reply ? "Atualizar resposta" : "Publicar resposta"}
          </TESButton>
        </div>
        {feedback ? (
          <TESFeedbackDialog
            message={feedback.message}
            onClose={() => {
              const focusId = feedback.focusId;
              setFeedback(null);
              if (focusId) {
                window.setTimeout(() => document.getElementById(focusId)?.focus(), 0);
              }
            }}
          />
        ) : null}
      </div>
    </TESDialog>
  );
}
