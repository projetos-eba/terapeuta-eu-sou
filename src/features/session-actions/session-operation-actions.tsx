"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, Check, CircleX, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";

import { TESFeedbackDialog } from "@/components/tes";
import { SessionChangeDialog } from "./session-change-dialog";
import { SessionDelayNotice } from "./session-delay-notice";

type ActorRole = "patient" | "therapist";

type RescheduleState = {
  expiresAt: string | null;
  id: string;
  kind?: "legacy" | "therapist_cancellation" | "therapist_reschedule";
  proposedEndsAt: string | null;
  proposedStartsAt: string | null;
  proposedTimezone: string;
  reason: string | null;
  requestedByCurrentUser: boolean;
  status:
    | "accepted"
    | "applied"
    | "cancelled"
    | "expired"
    | "pending"
    | "pending_admin_review"
    | "refunded"
    | "rejected";
} | null;

type SessionOperationActionsProps = {
  actorRole: ActorRole;
  bookingId: string;
  bookingVersion: number;
  bookingConfirmed?: boolean;
  canCancel: boolean;
  canRequestReschedule: boolean;
  cancelDisabledReason: string | null;
  cancellationImpactLabel: string;
  reschedule: RescheduleState;
  rescheduleDisabledReason: string | null;
  description?: string;
  delayNotice?: { participantJoined: boolean; sentAt: string | null };
  heading?: string;
  scheduledStartsAt?: string;
};

type DialogState = "cancel" | "reschedule" | "resolve_therapist_change" | null;

type ApiFailure = {
  ok: false;
  error?: {
    message?: string;
  };
};

export function SessionOperationActions({
  actorRole,
  bookingId,
  bookingVersion,
  bookingConfirmed,
  canCancel,
  canRequestReschedule,
  cancelDisabledReason,
  cancellationImpactLabel,
  description,
  delayNotice,
  heading,
  reschedule,
  rescheduleDisabledReason,
  scheduledStartsAt,
}: SessionOperationActionsProps) {
  const router = useRouter();
  const userFacingSubject = actorRole === "patient" ? "encontro" : "sessão";
  const userFacingSubjectWithArticle =
    actorRole === "patient" ? "este encontro" : "esta sessão";
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cancellationRequestId = useRef<string | null>(null);
  const rescheduleRequestId = useRef<string | null>(null);
  const resolutionRequestIds = useRef<Record<string, string>>({});
  const pendingReschedule =
    reschedule?.status === "pending" ||
    reschedule?.status === "pending_admin_review"
      ? reschedule
      : null;
  const canResolvePending =
    pendingReschedule?.status === "pending" &&
    !pendingReschedule.requestedByCurrentUser;
  const canCancelPending =
    pendingReschedule?.status === "pending" &&
    pendingReschedule.requestedByCurrentUser;

  async function submitCancel(reason: string) {
    const requestId = cancellationRequestId.current ?? crypto.randomUUID();
    cancellationRequestId.current = requestId;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        actorRole === "therapist"
          ? "/api/session/reschedule"
          : "/api/session/cancel",
        {
        body: JSON.stringify({
          ...(actorRole === "therapist"
            ? {
                actorRole,
                command: {
                  action: "therapist_change",
                  bookingId,
                  expectedBookingVersion: bookingVersion,
                  kind: "cancellation",
                  reason: reason || null,
                  requestId,
                },
              }
            : {
                actorRole,
                bookingId,
                userReason: reason || undefined,
                requestId,
              }),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | ApiFailure
        | { ok: true }
        | null;

      if (!response.ok || payload?.ok !== true) {
        setError(
          payload?.ok === false && payload.error?.message
            ? payload.error.message
            : `Não foi possível cancelar ${userFacingSubjectWithArticle} agora.`,
        );
        setIsSubmitting(false);
        return;
      }

      cancellationRequestId.current = null;
      setIsSubmitting(false);
      setDialog(null);
      router.refresh();
    } catch {
      setError(
        `Não foi possível cancelar ${userFacingSubjectWithArticle} agora.`,
      );
      setIsSubmitting(false);
    }
  }

  async function submitReschedule(input: {
    proposedStartsAt: string | null;
    reason: string;
  }) {
    const requestId = rescheduleRequestId.current ?? crypto.randomUUID();
    rescheduleRequestId.current = requestId;
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/session/reschedule", {
      body: JSON.stringify({
        actorRole,
        command:
          actorRole === "therapist"
            ? {
                action: "therapist_change",
                bookingId,
                expectedBookingVersion: bookingVersion,
                kind: "reschedule",
                reason: input.reason || null,
                requestId,
              }
            : {
                action: "request",
                bookingId,
                expectedBookingVersion: bookingVersion,
                proposedStartsAt: new Date(input.proposedStartsAt!).toISOString(),
                reason: input.reason || null,
                requestId,
              },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    if (!response) {
      setError(
        actorRole === "patient"
          ? "Não foi possível confirmar o reagendamento agora."
          : "Não foi possível solicitar o reagendamento agora.",
      );
      setIsSubmitting(false);
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | ApiFailure
      | { ok: true }
      | null;

    if (!response.ok || payload?.ok !== true) {
      setError(
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : actorRole === "patient"
            ? "Não foi possível confirmar o reagendamento agora."
            : "Não foi possível solicitar o reagendamento agora.",
      );
      setIsSubmitting(false);
      return;
    }

    rescheduleRequestId.current = null;
    setIsSubmitting(false);
    setDialog(null);
    router.refresh();
  }

  async function resolveReschedule(
    rescheduleRequestId: string,
    resolution: "accepted" | "cancelled" | "rejected",
  ) {
    const operationKey = `${rescheduleRequestId}:${resolution}`;
    const requestId =
      resolutionRequestIds.current[operationKey] ?? crypto.randomUUID();
    resolutionRequestIds.current[operationKey] = requestId;
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/session/reschedule", {
      body: JSON.stringify({
        actorRole,
        command: {
          action: "resolve",
          expectedBookingVersion: bookingVersion,
          requestId,
          rescheduleRequestId,
          resolution,
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    if (!response) {
      setError("Não foi possível atualizar o reagendamento agora.");
      setIsSubmitting(false);
      return;
    }
    const payload = (await response.json().catch(() => null)) as
      | ApiFailure
      | { ok: true }
      | null;

    if (!response.ok || payload?.ok !== true) {
      setError(
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : "Não foi possível atualizar o reagendamento agora.",
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    delete resolutionRequestIds.current[operationKey];
    router.refresh();
  }

  async function resolveTherapistChange(
    resolution: "refund" | "reschedule",
    proposedStartsAt?: string,
  ) {
    if (!pendingReschedule) return;
    const operationKey = `${pendingReschedule.id}:${resolution}`;
    const requestId =
      resolutionRequestIds.current[operationKey] ?? crypto.randomUUID();
    resolutionRequestIds.current[operationKey] = requestId;
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/session/reschedule", {
      body: JSON.stringify({
        actorRole,
        command: {
          action: "resolve_therapist_change",
          expectedBookingVersion: bookingVersion,
          ...(proposedStartsAt
            ? { proposedStartsAt: new Date(proposedStartsAt).toISOString() }
            : {}),
          requestId,
          rescheduleRequestId: pendingReschedule.id,
          resolution,
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    const payload = response
      ? ((await response.json().catch(() => null)) as ApiFailure | { ok: true } | null)
      : null;
    if (!response || !response.ok || payload?.ok !== true) {
      setError(
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : "Não foi possível registrar sua escolha agora.",
      );
      setIsSubmitting(false);
      return;
    }

    delete resolutionRequestIds.current[operationKey];
    setDialog(null);
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <section
      aria-label="Cancelamento e reagendamento"
      className="rounded-card border border-brand-lavender bg-white p-5 shadow-card"
    >
      <h2 className="font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
        {heading ?? `Alterar ${userFacingSubject}`}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {description ??
          `Reagendamentos e cancelamentos passam por validação da agenda, política ${actorRole === "patient" ? "do encontro" : "da sessão"} e estado de pagamento.`}
      </p>

      {pendingReschedule ? (
        <PendingReschedulePanel
          canCancelPending={canCancelPending}
          canResolvePending={canResolvePending}
          isSubmitting={isSubmitting}
          onResolve={(resolution) =>
            resolveReschedule(pendingReschedule.id, resolution)
          }
          onResolveTherapistChange={resolveTherapistChange}
          onOpenTherapistReschedule={() => {
            setError(null);
            setDialog("resolve_therapist_change");
          }}
          reschedule={pendingReschedule}
        />
      ) : null}

      {scheduledStartsAt && delayNotice ? (
        <SessionDelayNotice
          actorRole={actorRole}
          bookingConfirmed={bookingConfirmed === true}
          bookingId={bookingId}
          bookingVersion={bookingVersion}
          initialState={delayNotice}
          scheduledStartsAt={scheduledStartsAt}
        />
      ) : null}

      {error && dialog === null ? (
        <TESFeedbackDialog message={error} onClose={() => setError(null)} />
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canRequestReschedule || Boolean(pendingReschedule)}
          onClick={() => {
            rescheduleRequestId.current = crypto.randomUUID();
            setError(null);
            setDialog("reschedule");
          }}
          title={
            pendingReschedule
              ? "Já existe uma proposta de reagendamento em aberto."
              : (rescheduleDisabledReason ?? undefined)
          }
          type="button"
        >
          <CalendarClock aria-hidden="true" size={18} />
          {actorRole === "patient"
            ? "Reagendar encontro"
            : "Solicitar alteração"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-status-danger/30 bg-white px-4 text-sm font-extrabold text-status-danger transition hover:bg-status-dangerBg disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canCancel}
          onClick={() => {
            cancellationRequestId.current = crypto.randomUUID();
            setError(null);
            setDialog("cancel");
          }}
          title={cancelDisabledReason ?? undefined}
          aria-describedby={
            !canCancel && cancelDisabledReason
              ? `${bookingId}-cancel-disabled-reason`
              : undefined
          }
          type="button"
        >
          <CircleX aria-hidden="true" size={18} />
          {actorRole === "therapist" ? "Solicitar cancelamento" : `Cancelar ${userFacingSubject}`}
        </button>
      </div>
      {!canRequestReschedule && rescheduleDisabledReason ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-tesText-secondary">
          Reagendamento indisponível: {rescheduleDisabledReason}
        </p>
      ) : null}
      {!canCancel && cancelDisabledReason ? (
        <p
          className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary"
          id={`${bookingId}-cancel-disabled-reason`}
        >
          Cancelamento indisponível: {cancelDisabledReason}
        </p>
      ) : null}

      {dialog === "cancel" ? (
        <SessionChangeDialog
          actorRole={actorRole}
          bookingId={bookingId}
          errorMessage={error}
          impactLabel={cancellationImpactLabel}
          isSubmitting={isSubmitting}
          mode="cancel"
          onClose={() => {
            cancellationRequestId.current = null;
            setDialog(null);
          }}
          onSubmitCancel={submitCancel}
          onSubmitReschedule={submitReschedule}
        />
      ) : null}

      {dialog === "reschedule" ? (
        <SessionChangeDialog
          actorRole={actorRole}
          bookingId={bookingId}
          errorMessage={error}
          impactLabel={cancellationImpactLabel}
          isSubmitting={isSubmitting}
          mode="reschedule"
          onClose={() => {
            rescheduleRequestId.current = null;
            setDialog(null);
          }}
          onSubmitCancel={submitCancel}
          onSubmitReschedule={submitReschedule}
        />
      ) : null}

      {dialog === "resolve_therapist_change" ? (
        <SessionChangeDialog
          actorRole="patient"
          bookingId={bookingId}
          errorMessage={error}
          impactLabel={cancellationImpactLabel}
          isSubmitting={isSubmitting}
          mode="reschedule"
          onClose={() => setDialog(null)}
          onSubmitCancel={submitCancel}
          onSubmitReschedule={(input) =>
            resolveTherapistChange("reschedule", input.proposedStartsAt ?? undefined)
          }
        />
      ) : null}
    </section>
  );
}

function PendingReschedulePanel({
  canCancelPending,
  canResolvePending,
  isSubmitting,
  onOpenTherapistReschedule,
  onResolve,
  onResolveTherapistChange,
  reschedule,
}: {
  canCancelPending: boolean;
  canResolvePending: boolean;
  isSubmitting: boolean;
  onOpenTherapistReschedule: () => void;
  onResolve: (resolution: "accepted" | "cancelled" | "rejected") => void;
  onResolveTherapistChange: (
    resolution: "refund" | "reschedule",
  ) => void;
  reschedule: NonNullable<RescheduleState>;
}) {
  if (reschedule.status === "pending_admin_review") {
    return (
      <div className="mt-5 rounded-xl border border-status-warning/30 bg-status-warningBg p-4">
        <p className="text-sm font-extrabold text-brand-deep">
          Reembolso em análise pelo TES
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          O encontro foi encerrado e nossa equipe está verificando a solução financeira.
        </p>
      </div>
    );
  }

  const therapistChange =
    reschedule.kind === "therapist_reschedule" ||
    reschedule.kind === "therapist_cancellation";

  return (
    <div className="mt-5 rounded-xl border border-status-warning/30 bg-status-warningBg p-4">
      <p className="text-sm font-extrabold text-brand-deep">
        Proposta de reagendamento em aberto
      </p>
      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
        {therapistChange
          ? reschedule.kind === "therapist_cancellation"
            ? "Seu terapeuta solicitou o cancelamento deste encontro."
            : "Seu terapeuta pediu que você escolha outro horário."
          : reschedule.proposedStartsAt
            ? `Novo horário sugerido: ${formatDateTime(reschedule.proposedStartsAt, reschedule.proposedTimezone)}`
            : "Aguardando definição do próximo passo."}
      </p>
      {reschedule.reason ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary">
          Motivo: {reschedule.reason}
        </p>
      ) : null}
      {therapistChange && !reschedule.requestedByCurrentUser ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-xs font-extrabold text-white disabled:opacity-60"
            disabled={isSubmitting}
            onClick={onOpenTherapistReschedule}
            type="button"
          >
            <CalendarClock aria-hidden="true" size={16} />
            Reagendar encontro
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-status-danger/30 bg-white px-4 text-xs font-extrabold text-status-danger disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => onResolveTherapistChange("refund")}
            type="button"
          >
            <CircleX aria-hidden="true" size={16} />
            Solicitar reembolso integral
          </button>
        </div>
      ) : canResolvePending || canCancelPending ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canResolvePending ? (
            <>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-primary px-4 text-xs font-extrabold text-white disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => onResolve("accepted")}
                type="button"
              >
                <Check aria-hidden="true" size={16} />
                Aceitar
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-xs font-extrabold text-brand-primary disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => onResolve("rejected")}
                type="button"
              >
                <X aria-hidden="true" size={16} />
                Recusar
              </button>
            </>
          ) : null}
          {canCancelPending ? (
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-xs font-extrabold text-brand-primary disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => onResolve("cancelled")}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Retirar solicitação
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
