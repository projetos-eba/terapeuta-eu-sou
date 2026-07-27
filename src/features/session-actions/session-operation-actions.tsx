"use client";

import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  CircleX,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { TESDialog } from "@/components/tes/tes-dialog";

type ActorRole = "patient" | "therapist";

type RescheduleState = {
  expiresAt: string | null;
  id: string;
  proposedEndsAt: string;
  proposedStartsAt: string;
  proposedTimezone: string;
  reason: string | null;
  requestedByCurrentUser: boolean;
  status: "accepted" | "applied" | "cancelled" | "expired" | "pending" | "rejected";
} | null;

type SessionOperationActionsProps = {
  actorRole: ActorRole;
  bookingId: string;
  bookingVersion: number;
  canCancel: boolean;
  canRequestReschedule: boolean;
  reschedule: RescheduleState;
};

type DialogState = "cancel" | "reschedule" | null;

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
  canCancel,
  canRequestReschedule,
  reschedule,
}: SessionOperationActionsProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingReschedule = reschedule?.status === "pending" ? reschedule : null;
  const canResolvePending =
    Boolean(pendingReschedule) && !pendingReschedule?.requestedByCurrentUser;
  const canCancelPending =
    Boolean(pendingReschedule) &&
    Boolean(pendingReschedule?.requestedByCurrentUser);

  async function submitCancel(reason: string) {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/session/cancel", {
      body: JSON.stringify({
        actorRole,
        bookingId,
        reason: reason || undefined,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiFailure
      | { ok: true }
      | null;

    if (!response.ok || payload?.ok !== true) {
      setError(
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : "Não foi possível cancelar esta sessão agora.",
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setDialog(null);
    router.refresh();
  }

  async function submitReschedule(input: {
    proposedStartsAt: string;
    reason: string;
  }) {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/session/reschedule", {
      body: JSON.stringify({
        actorRole,
        command: {
          action: "request",
          bookingId,
          expectedBookingVersion: bookingVersion,
          proposedStartsAt: new Date(input.proposedStartsAt).toISOString(),
          reason: input.reason || null,
          requestId: crypto.randomUUID(),
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiFailure
      | { ok: true }
      | null;

    if (!response.ok || payload?.ok !== true) {
      setError(
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : "Não foi possível solicitar o reagendamento agora.",
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setDialog(null);
    router.refresh();
  }

  async function resolveReschedule(
    rescheduleRequestId: string,
    resolution: "accepted" | "cancelled" | "rejected",
  ) {
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/session/reschedule", {
      body: JSON.stringify({
        actorRole,
        command: {
          action: "resolve",
          expectedBookingVersion: bookingVersion,
          requestId: crypto.randomUUID(),
          rescheduleRequestId,
          resolution,
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
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
    router.refresh();
  }

  return (
    <section
      aria-label="Cancelamento e reagendamento"
      className="rounded-card border border-brand-lavender bg-white p-5 shadow-card"
    >
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Alterar sessão
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Reagendamentos e cancelamentos passam por validação da agenda, política
        da sessão e estado de pagamento.
      </p>

      {pendingReschedule ? (
        <PendingReschedulePanel
          canCancelPending={canCancelPending}
          canResolvePending={canResolvePending}
          isSubmitting={isSubmitting}
          onResolve={(resolution) =>
            resolveReschedule(pendingReschedule.id, resolution)
          }
          reschedule={pendingReschedule}
        />
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canRequestReschedule || Boolean(pendingReschedule)}
          onClick={() => {
            setError(null);
            setDialog("reschedule");
          }}
          type="button"
        >
          <CalendarClock aria-hidden="true" size={18} />
          Solicitar reagendamento
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-status-danger/30 bg-white px-4 text-sm font-extrabold text-status-danger transition hover:bg-status-dangerBg disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canCancel}
          onClick={() => {
            setError(null);
            setDialog("cancel");
          }}
          type="button"
        >
          <CircleX aria-hidden="true" size={18} />
          Cancelar sessão
        </button>
      </div>

      {dialog === "cancel" ? (
        <CancelDialog
          isSubmitting={isSubmitting}
          onClose={() => setDialog(null)}
          onSubmit={submitCancel}
        />
      ) : null}

      {dialog === "reschedule" ? (
        <RescheduleDialog
          isSubmitting={isSubmitting}
          onClose={() => setDialog(null)}
          onSubmit={submitReschedule}
        />
      ) : null}
    </section>
  );
}

function PendingReschedulePanel({
  canCancelPending,
  canResolvePending,
  isSubmitting,
  onResolve,
  reschedule,
}: {
  canCancelPending: boolean;
  canResolvePending: boolean;
  isSubmitting: boolean;
  onResolve: (resolution: "accepted" | "cancelled" | "rejected") => void;
  reschedule: NonNullable<RescheduleState>;
}) {
  return (
    <div className="mt-5 rounded-xl border border-status-warning/30 bg-status-warningBg p-4">
      <p className="text-sm font-extrabold text-brand-deep">
        Proposta de reagendamento em aberto
      </p>
      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
        Novo horário sugerido:{" "}
        {formatDateTime(reschedule.proposedStartsAt, reschedule.proposedTimezone)}
      </p>
      {reschedule.reason ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-tesText-secondary">
          Motivo: {reschedule.reason}
        </p>
      ) : null}
      {canResolvePending || canCancelPending ? (
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

function CancelDialog({
  isSubmitting,
  onClose,
  onSubmit,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <TESDialog
      description="O backend aplica a política de cancelamento, bloqueia repasse quando necessário e só registra reembolso depois da operação financeira."
      onClose={onClose}
      title="Cancelar sessão"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(reason);
        }}
      >
        <label className="grid gap-2">
          <span className="text-sm font-extrabold text-brand-deep">
            Motivo opcional
          </span>
          <textarea
            className="min-h-[110px] rounded-lg border border-brand-lavender px-4 py-3 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            maxLength={240}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Conte brevemente o motivo, se fizer sentido."
            value={reason}
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
            onClick={onClose}
            type="button"
          >
            Voltar
          </button>
          <SubmitButton
            isSubmitting={isSubmitting}
            label="Confirmar cancelamento"
            tone="danger"
          />
        </div>
      </form>
    </TESDialog>
  );
}

function RescheduleDialog({
  isSubmitting,
  onClose,
  onSubmit,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: { proposedStartsAt: string; reason: string }) => void;
}) {
  const defaultStartsAt = useMemo(() => getDefaultLocalDateTime(), []);
  const [proposedStartsAt, setProposedStartsAt] = useState(defaultStartsAt);
  const [reason, setReason] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposedStartsAt) return;
    onSubmit({ proposedStartsAt, reason });
  }

  return (
    <TESDialog
      description="A plataforma vai validar o horário na agenda autoritativa antes de criar a proposta."
      onClose={onClose}
      title="Solicitar reagendamento"
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2">
          <span className="text-sm font-extrabold text-brand-deep">
            Novo dia e horário
          </span>
          <input
            className="min-h-12 rounded-lg border border-brand-lavender px-4 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            min={getDefaultLocalDateTime()}
            onChange={(event) => setProposedStartsAt(event.target.value)}
            required
            type="datetime-local"
            value={proposedStartsAt}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-extrabold text-brand-deep">
            Motivo opcional
          </span>
          <textarea
            className="min-h-[92px] rounded-lg border border-brand-lavender px-4 py-3 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            maxLength={240}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explique a necessidade de ajuste, se quiser."
            value={reason}
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
            onClick={onClose}
            type="button"
          >
            Voltar
          </button>
          <SubmitButton isSubmitting={isSubmitting} label="Enviar proposta" />
        </div>
      </form>
    </TESDialog>
  );
}

function SubmitButton({
  isSubmitting,
  label,
  tone = "brand",
}: {
  isSubmitting: boolean;
  label: string;
  tone?: "brand" | "danger";
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold text-white disabled:opacity-60 ${
        tone === "danger" ? "bg-status-danger" : "bg-brand-primary"
      }`}
      disabled={isSubmitting}
      type="submit"
    >
      {isSubmitting ? (
        <Loader2 aria-hidden="true" className="animate-spin" size={17} />
      ) : null}
      {label}
    </button>
  );
}

function getDefaultLocalDateTime() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return toDatetimeLocalValue(date);
}

function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
