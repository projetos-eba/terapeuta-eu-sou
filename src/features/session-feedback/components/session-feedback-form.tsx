"use client";

import { CheckCircle2, CircleAlert, Loader2, Send, ShieldCheck, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  onSubmitted?: (
    feedback: SessionFeedbackRecord,
    readPayload: SessionFeedbackReadPayload | null,
  ) => void;
  sessionLabel: string;
};

export function SessionFeedbackForm({
  actorRole,
  bookingId,
  introductoryMessage,
  onSubmitted,
  sessionLabel,
}: SessionFeedbackFormProps) {
  const [status, setStatus] = useState<SessionFeedbackStatus>("loading");
  const [existingFeedback, setExistingFeedback] = useState<SessionFeedbackRecord | null>(null);
  const [readPayload, setReadPayload] = useState<SessionFeedbackReadPayload | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<"completed" | "not_performed" | "">("");
  const [rating, setRating] = useState(0);
  const [reason, setReason] = useState<SessionFeedbackReason | "">("");
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

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

        setReadPayload(payload.data);
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
    if (!isQualityEligible && !isIncidentOnly) return false;
    if (selectedOutcome === "completed") return rating >= 1 && rating <= 5;
    if (selectedOutcome === "not_performed" || isIncidentOnly) return Boolean(reason);
    return false;
  }, [isIncidentOnly, isQualityEligible, rating, reason, selectedOutcome]);

  async function submitFeedback() {
    if (!canSubmit || isSubmitting || existingFeedback) return;

    setStatus("sent");
    setErrorMessage(null);
    requestIdRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/session-feedback", {
        body: JSON.stringify({
          bookingId,
          comment: comment.trim(),
          notPerformedReason:
            selectedOutcome === "not_performed" || isIncidentOnly ? reason : null,
          outcome:
            selectedOutcome === "not_performed" || isIncidentOnly
              ? "not_performed"
              : "completed",
          rating: selectedOutcome === "completed" ? rating : null,
          requestId: requestIdRef.current,
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
      const refreshed = await loadReadPayload(bookingId);
      if (refreshed) setReadPayload(refreshed);
      onSubmitted?.(payload.data.feedback, refreshed);
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
  const subjectDefinite = actorRole === "patient" ? "o encontro" : "a sessão";
  const subjectEnded = actorRole === "patient" ? "O encontro foi encerrado" : "A sessão foi encerrada";
  const subjectWithArticle = actorRole === "patient" ? "este encontro" : "esta sessão";
  const subjectWithPreposition = actorRole === "patient" ? "deste encontro" : "desta sessão";

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
          Ainda estamos confirmando os dados {subjectWithPreposition}. O feedback ficará disponível quando houver pagamento confirmado.
        </div>
      ) : null}

      {status === "before_session" ? (
        <FeedbackInfoState>
          O feedback aparece depois do horário final {subjectWithPreposition}.
        </FeedbackInfoState>
      ) : null}

      {status === "waiting_for_participants" ? (
        <FeedbackInfoState>
          Ainda não há registro da entrada dos dois participantes. Quando {subjectDefinite}
          acontecer, você poderá compartilhar como foi.
        </FeedbackInfoState>
      ) : null}

      {status === "attendance_pending" ? (
        <FeedbackInfoState>
          {subjectEnded}, mas ainda estamos confirmando a presença
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
        <FeedbackSentState actorRole={actorRole} feedback={existingFeedback} payload={readPayload} />
      ) : isQualityEligible || isIncidentOnly ? (
        <div className="mt-6 grid gap-6">
          {isQualityEligible ? (
            <fieldset>
              <legend className="text-base font-extrabold text-brand-deep">
                {subjectWithArticle.charAt(0).toUpperCase() + subjectWithArticle.slice(1)} aconteceu?
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <OutcomeButton
                  checked={selectedOutcome === "completed"}
                  label="Sim, foi realizado"
                  onClick={() => {
                    setSelectedOutcome("completed");
                    setReason("");
                  }}
                />
                <OutcomeButton
                  checked={selectedOutcome === "not_performed"}
                  label="Não foi realizado"
                  onClick={() => {
                    setSelectedOutcome("not_performed");
                    setRating(0);
                  }}
                />
              </div>
            </fieldset>
          ) : null}

          {isQualityEligible && selectedOutcome === "completed" ? (
            <fieldset>
              <legend className="text-base font-extrabold text-brand-deep">Como você avalia {subjectWithArticle}?</legend>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                A nota desta resposta permanece privada. A avaliação pública do terapeuta é uma etapa opcional e separada.
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
          ) : isIncidentOnly || selectedOutcome === "not_performed" ? (
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
          ) : null}

          <label className="grid gap-2 text-sm font-extrabold text-brand-deep" htmlFor="session-feedback-comment">
            Observações <span className="font-semibold text-tesText-muted">(opcional)</span>
            <textarea
              className="min-h-28 resize-y rounded-2xl border border-brand-lavender bg-white px-4 py-3 text-sm font-semibold text-tesText-primary outline-none placeholder:text-tesText-muted focus-visible:ring-4 focus-visible:ring-ring/20"
              id="session-feedback-comment"
              maxLength={500}
              onChange={(event) => setComment(event.target.value.slice(0, 500))}
              placeholder={`Compartilhe algo importante sobre ${subjectWithArticle}…`}
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

function OutcomeButton({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`min-h-12 rounded-xl border px-4 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
        checked
          ? "border-brand-primary bg-brand-lavenderSoft text-brand-deep"
          : "border-brand-lavender bg-white text-tesText-secondary hover:bg-surface-soft"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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

function FeedbackSentState({
  actorRole,
  feedback,
  payload,
}: {
  actorRole: "patient" | "therapist";
  feedback: SessionFeedbackRecord;
  payload: SessionFeedbackReadPayload | null;
}) {
  const waitingForCounterpart =
    payload?.confirmationState === "awaiting_patient" ||
    payload?.confirmationState === "awaiting_therapist" ||
    payload?.confirmationState === "awaiting_both";

  return (
    <div className="mt-6 grid gap-4 rounded-2xl border border-status-success/30 bg-status-successBg/60 p-5">
      <p className="flex items-center gap-2 text-base font-extrabold text-brand-deep">
        <CheckCircle2 aria-hidden="true" className="text-status-success" size={20} />
        Sua confirmação foi registrada
      </p>
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        {waitingForCounterpart
          ? `Sua resposta permanece privada. Ainda falta a confirmação ${payload?.confirmationState === "awaiting_patient" ? "do paciente" : "do terapeuta"}.`
          : payload?.confirmationState === "blocked_for_review"
            ? `Sua resposta permanece privada e ${actorRole === "patient" ? "o encontro foi bloqueado" : "a sessão foi bloqueada"} para análise da equipe.`
            : "Sua resposta permanece privada. A confirmação financeira segue o prazo de segurança e o próximo lote aplicável."}
      </p>
      <div className="flex flex-wrap gap-2 text-sm font-extrabold text-brand-deep">
        <span className="rounded-full bg-white px-3 py-2">
          {feedback.outcome === "completed"
            ? actorRole === "patient" ? "Encontro realizado" : "Sessão realizada"
            : actorRole === "patient" ? "Encontro não realizado" : "Sessão não realizada"}
        </span>
        {feedback.rating ? <span className="rounded-full bg-white px-3 py-2">{feedback.rating}/5</span> : null}
      </div>
    </div>
  );
}

async function loadReadPayload(bookingId: string) {
  try {
    const response = await fetch(
      `/api/session-feedback?bookingId=${encodeURIComponent(bookingId)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as
      | { data?: SessionFeedbackReadPayload; ok?: boolean }
      | null;
    return response.ok && payload?.ok && payload.data ? payload.data : null;
  } catch {
    return null;
  }
}
