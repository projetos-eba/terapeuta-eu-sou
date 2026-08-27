"use client";

import { CheckCircle2, EyeOff, Loader2, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TESButton } from "@/components/tes";

import type {
  PatientTherapistReview,
  PatientTherapistReviewReadPayload,
} from "../session-feedback.types";

export function PatientPublicReviewForm({
  therapistName,
  therapistProfileId,
}: {
  therapistName: string;
  therapistProfileId: string;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [review, setReview] = useState<PatientTherapistReview | null>(null);
  const [eligible, setEligible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPatientReview(therapistProfileId).then((payload) => {
      if (cancelled) return;
      if (!payload) {
        setStatus("error");
        return;
      }
      setEligible(payload.eligible);
      setReview(payload.review);
      setRating(payload.review?.rating ?? 0);
      setComment(payload.review?.comment ?? "");
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [therapistProfileId]);

  async function mutate(action: "save" | "hide" | "publish") {
    if (action !== "hide" && rating < 1) return;
    requestIdRef.current = crypto.randomUUID();
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/patient/reviews", {
        body: JSON.stringify({
          action,
          comment: comment.trim(),
          rating: action === "hide" ? null : rating,
          requestId: requestIdRef.current,
          therapistProfileId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { review?: PatientTherapistReview }; error?: { message?: string }; ok?: boolean }
        | null;
      if (!response.ok || !payload?.ok || !payload.data?.review) {
        throw new Error(payload?.error?.message ?? "review_failed");
      }
      setReview(payload.data.review);
      setRating(payload.data.review.rating);
      setComment(payload.data.review.comment);
      setMessage(
        action === "hide"
          ? "Avaliação ocultada do perfil público."
          : action === "publish"
            ? "Avaliação republicada."
            : "Avaliação publicada no perfil do terapeuta.",
      );
      setStatus("ready");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message !== "review_failed"
          ? error.message
          : "Não foi possível atualizar a avaliação agora.",
      );
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-tesText-secondary">
        <Loader2 aria-hidden="true" className="animate-spin" size={18} />
        Preparando a avaliação pública…
      </p>
    );
  }

  if (!eligible) {
    return (
      <p className="rounded-xl bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
        A avaliação pública será liberada após a confirmação de um encontro realizado com este terapeuta.
      </p>
    );
  }

  return (
    <section aria-labelledby="public-review-title" className="grid gap-5">
      <div>
        <h3 className="text-lg font-extrabold text-brand-deep" id="public-review-title">
          Avaliar {therapistName} publicamente
        </h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Esta etapa é opcional, editável e não interfere na confirmação nem no pagamento do encontro.
        </p>
      </div>

      <div aria-label="Nota pública de 1 a 5" className="flex gap-2" role="radiogroup">
        {Array.from({ length: 5 }, (_, index) => {
          const value = index + 1;
          return (
            <button
              aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
              aria-pressed={value <= rating}
              className="grid min-h-12 min-w-12 place-items-center rounded-full text-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              key={value}
              onClick={() => setRating(value)}
              type="button"
            >
              <Star aria-hidden="true" className={value <= rating ? "fill-brand-primary" : ""} size={28} />
            </button>
          );
        })}
      </div>

      <label className="grid gap-2 text-sm font-extrabold text-brand-deep" htmlFor="patient-public-review-comment">
        Comentário <span className="font-semibold text-tesText-muted">(opcional)</span>
        <textarea
          className="min-h-28 resize-y rounded-xl border border-brand-lavender bg-white px-4 py-3 text-sm font-semibold text-tesText-primary outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
          id="patient-public-review-comment"
          maxLength={1000}
          onChange={(event) => setComment(event.target.value.slice(0, 1000))}
          value={comment}
        />
      </label>

      {message ? (
        <p aria-live="polite" className={`rounded-xl p-4 text-sm font-bold ${status === "error" ? "bg-status-errorBg text-status-error" : "bg-status-successBg text-status-success"}`}>
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <TESButton
          disabled={rating < 1 || status === "saving"}
          onClick={() => void mutate(review?.status === "hidden" ? "publish" : "save")}
          type="button"
          variant="gradient"
        >
          {status === "saving" ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : <CheckCircle2 aria-hidden="true" size={18} />}
          {review?.status === "hidden" ? "Republicar avaliação" : review ? "Salvar alterações" : "Publicar avaliação"}
        </TESButton>
        {review?.status === "published" ? (
          <TESButton disabled={status === "saving"} onClick={() => void mutate("hide")} type="button" variant="secondary">
            <EyeOff aria-hidden="true" size={18} />
            Ocultar
          </TESButton>
        ) : null}
      </div>
    </section>
  );
}

async function loadPatientReview(therapistProfileId: string) {
  try {
    const response = await fetch(
      `/api/patient/reviews?therapistProfileId=${encodeURIComponent(therapistProfileId)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as
      | { data?: PatientTherapistReviewReadPayload; ok?: boolean }
      | null;
    return response.ok && payload?.ok && payload.data ? payload.data : null;
  } catch {
    return null;
  }
}
