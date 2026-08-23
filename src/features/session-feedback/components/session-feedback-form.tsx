"use client";

import { CheckCircle2, CircleAlert, Loader2, Send, ShieldCheck, Star } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { TESButton } from "@/components/tes";

import {
  SESSION_FEEDBACK_REASONS,
  type SessionFeedbackReason,
  type SessionFeedbackReadPayload,
  type SessionFeedbackRecord,
  type SessionFeedbackStatus,
} from "../session-feedback.types";

type SessionFeedbackFormProps = {
  actorRole: "patient" | "therapist";
  bookingId: string;
  introductoryMessage?: string | null;
  sessionLabel: string;
};

export function SessionFeedbackForm({
  actorRole,
  bookingId,
  introductoryMessage,
  sessionLabel,
}: SessionFeedbackFormProps) {
  const [status, setStatus] = useState<SessionFeedbackStatus>("loading");
  const [existingFeedback, setExistingFeedback] = useState<SessionFeedbackRecord | null>(null);
  const [rating, setRating] = useState(0);
  const [reason, setReason] = useState<SessionFeedbackReason | "">("");
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFeedback() {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/session-feedback?bookingId=${encodeURIComponent(bookingId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as
          | { data?: SessionFeedbackReadPayload; ok?: boolean }
          | null;

        if (!response.ok || !payload?.ok || !payload.data) {
          throw new Error("feedback_unavailable");
        }

        if (cancelled) return;

        setExistingFeedback(payload.data.feedback);
        setStatus(payload.data.feedback ? "sent" : payload.data.status);
        if (payload.data.feedback) {
          setRating(payload.data.feedback.rating ?? 0);
          setReason(payload.data.feedback.notPerformedReason ?? "");
          setComment(payload.data.feedback.comment);
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Não conseguimos consultar seu feedback agora. Você ainda pode tentar enviar sua resposta.");
        }
      }
    }

    void loadFeedback();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const isSubmitting = status === "sent" && !existingFeedback;
  const isQualityEligible = status === "eligible";
  const isIncidentOnly = status === "incident_only";
  const canSubmit = useMemo(() => {
    if (isQualityEligible) return rating >= 1 && rating <= 5;
    if (!isIncidentOnly) return false;
    return Boolean(reason);
  }, [isIncidentOnly, isQualityEligible, rating, reason]);

  async function submitFeedback() {
    if (!canSubmit || isSubmitting || existingFeedback) return;

    setStatus("sent");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/session-feedback", {
        body: JSON.stringify({
          bookingId,
          comment: comment.trim(),
          notPerformedReason: isIncidentOnly ? reason : null,
          outcome: isIncidentOnly ? "not_performed" : "completed",
          rating: isQualityEligible ? rating : null,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { feedback?: SessionFeedbackRecord }; error?: { message?: string }; ok?: boolean }
        | null;

      if (!response.ok || !payload?.ok || !payload.data?.feedback) {
        throw new Error(payload?.error?.message ?? "feedback_submit_failed");
      }

      setExistingFeedback(payload.data.feedback);
      setStatus("sent");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error && error.message !== "feedback_submit_failed"
          ? error.message
          : "Não conseguimos registrar seu feedback. Tente novamente.",
      );
    }
  }

  const rolePhrase = actorRole === "patient" ? "seu encontro" : "sua sessão";

  return (
    <section
      aria-labelledby="session-feedback-title"
      className="mx-auto w-full max-w-[760px] rounded-[28px] border border-brand-lavender/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(44,25,95,0.12)] sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <ShieldCheck aria-hidden="true" size={21} />
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">{sessionLabel}</p>
          <h2 id="session-feedback-title" className="mt-1 font-display text-3xl font-light italic text-brand-deep sm:text-4xl">
            Como foi {rolePhrase}?
          </h2>
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
        Sua resposta é privada e ajuda a equipe a acompanhar a qualidade da sala online.
      </p>

      {introductoryMessage ? (
        <p aria-live="polite" className="mt-4 rounded-2xl bg-surface-soft px-4 py-3 text-sm font-semibold text-tesText-secondary">
          {introductoryMessage}
        </p>
      ) : null}

      {status === "loading" ? (
        <div aria-live="polite" className="mt-6 flex items-center gap-2 rounded-2xl bg-surface-soft px-4 py-3 text-sm font-semibold text-tesText-secondary">
          <Loader2 aria-hidden="true" className="animate-spin text-brand-primary" size={18} />
          Preparando o feedback…
        </div>
      ) : null}

      {status === "unavailable" ? (
        <div aria-live="polite" className="mt-6 flex items-start gap-2 rounded-2xl bg-surface-soft px-4 py-3 text-sm font-semibold leading-6 text-tesText-secondary">
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={18} />
          Ainda estamos confirmando os dados deste encontro. O feedback ficará disponível quando houver pagamento confirmado.
        </div>
      ) : null}

      {status === "before_session" ? (
        <FeedbackInfoState>
          O feedback aparece depois do horário do encontro e somente quando a
          entrada dos dois participantes tiver sido confirmada.
        </FeedbackInfoState>
      ) : null}

      {status === "waiting_for_participants" ? (
        <FeedbackInfoState>
          Ainda não há registro da entrada dos dois participantes. Quando o
          encontro acontecer, você poderá compartilhar como foi.
        </FeedbackInfoState>
      ) : null}

      {status === "attendance_pending" ? (
        <FeedbackInfoState>
          O encontro foi encerrado, mas ainda estamos confirmando a presença
          dos dois participantes. Esta tela será atualizada quando houver uma
          confirmação segura.
        </FeedbackInfoState>
      ) : null}

      {status === "error" ? (
        <div aria-live="assertive" className="mt-6 flex items-start gap-2 rounded-2xl bg-status-errorBg px-4 py-3 text-sm font-semibold leading-6 text-status-error">
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          {errorMessage ?? "Não conseguimos consultar o feedback agora. Tente novamente mais tarde."}
        </div>
      ) : null}

      {existingFeedback ? (
        <FeedbackSentState feedback={existingFeedback} />
      ) : isQualityEligible || isIncidentOnly ? (
        <div className="mt-6 grid gap-6">
          {isQualityEligible ? (
            <fieldset>
              <legend className="text-base font-extrabold text-brand-deep">Como você avalia a qualidade da chamada?</legend>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                Os dois participantes entraram no encontro. Conte como foi a sua experiência.
              </p>
              <div aria-label="Nota de 1 a 5" className="mt-3 flex gap-1 sm:gap-3" role="radiogroup">
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  const selected = value <= rating;

                  return (
                    <button
                      aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                      aria-pressed={selected}
                      className="grid min-h-12 min-w-12 place-items-center rounded-full text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                      key={value}
                      onClick={() => setRating(value)}
                      type="button"
                    >
                      <Star aria-hidden="true" className={selected ? "fill-brand-primary" : ""} size={30} />
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <fieldset>
              <legend className="text-base font-extrabold text-brand-deep">O que aconteceu?</legend>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                Este relato é separado da avaliação de qualidade e permanece privado.
              </p>
              <div className="mt-3 grid gap-2">
                {SESSION_FEEDBACK_REASONS.map((item) => (
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-brand-lavender/70 px-4 py-3 text-sm font-semibold text-brand-deep has-[:checked]:border-brand-primary has-[:checked]:bg-brand-lavenderSoft" key={item.value}>
                    <input
                      checked={reason === item.value}
                      className="size-5 accent-brand-primary"
                      name="session-feedback-reason"
                      onChange={() => setReason(item.value)}
                      type="radio"
                      value={item.value}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="grid gap-2 text-sm font-extrabold text-brand-deep" htmlFor="session-feedback-comment">
            Observações <span className="font-semibold text-tesText-muted">(opcional)</span>
            <textarea
              className="min-h-28 resize-y rounded-2xl border border-brand-lavender bg-white px-4 py-3 text-sm font-semibold text-tesText-primary outline-none placeholder:text-tesText-muted focus-visible:ring-4 focus-visible:ring-ring/20"
              id="session-feedback-comment"
              maxLength={500}
              onChange={(event) => setComment(event.target.value.slice(0, 500))}
              placeholder="Compartilhe algo importante sobre esta sessão…"
              value={comment}
            />
            <span className="text-right text-xs font-semibold text-tesText-muted">{comment.length}/500</span>
          </label>

          {errorMessage ? (
            <p aria-live="assertive" className="flex items-start gap-2 rounded-2xl bg-status-errorBg px-4 py-3 text-sm font-semibold leading-6 text-status-error">
              <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              {errorMessage}
            </p>
          ) : null}

          <TESButton
            className="w-full"
            disabled={!canSubmit || isSubmitting}
            onClick={() => void submitFeedback()}
            size="lg"
            type="button"
            variant="gradient"
          >
            {isSubmitting ? <Loader2 aria-hidden="true" className="animate-spin" size={20} /> : <Send aria-hidden="true" size={18} />}
            {isSubmitting ? "Enviando…" : "Enviar feedback"}
          </TESButton>
        </div>
      ) : null}
    </section>
  );
}

function FeedbackInfoState({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" className="mt-6 flex items-start gap-2 rounded-2xl bg-surface-soft px-4 py-4 text-sm font-semibold leading-6 text-tesText-secondary">
      <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={18} />
      <span>{children}</span>
    </div>
  );
}

function FeedbackSentState({ feedback }: { feedback: SessionFeedbackRecord }) {
  return (
    <div className="mt-6 grid gap-4 rounded-2xl border border-status-success/30 bg-status-successBg/60 p-5">
      <p className="flex items-center gap-2 text-base font-extrabold text-brand-deep">
        <CheckCircle2 aria-hidden="true" className="text-status-success" size={20} />
        Feedback registrado
      </p>
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        Obrigado por compartilhar sua experiência. Sua resposta permanece privada.
      </p>
      <div className="flex flex-wrap gap-2 text-sm font-extrabold text-brand-deep">
        <span className="rounded-full bg-white px-3 py-2">{feedback.outcome === "completed" ? "Sessão realizada" : "Sessão não realizada"}</span>
        {feedback.rating ? <span className="rounded-full bg-white px-3 py-2">{feedback.rating}/5</span> : null}
      </div>
    </div>
  );
}
