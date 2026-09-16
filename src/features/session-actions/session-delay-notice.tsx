"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { TESDialog } from "@/components/tes";

type DelayNoticeState = {
  participantJoined: boolean;
  sentAt: string | null;
};

export function SessionDelayNotice({
  actorRole,
  bookingConfirmed,
  bookingId,
  bookingVersion,
  initialState,
  scheduledStartsAt,
}: {
  actorRole: "patient" | "therapist";
  bookingConfirmed: boolean;
  bookingId: string;
  bookingVersion: number;
  initialState: DelayNoticeState;
  scheduledStartsAt: string;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sentAt, setSentAt] = useState(initialState.sentAt);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const startMs = Date.parse(scheduledStartsAt);
  const inWindow =
    Number.isFinite(startMs) &&
    nowMs >= startMs - 60 * 60_000 &&
    nowMs <= startMs + 10 * 60_000;
  if (!bookingConfirmed || !inWindow || initialState.participantJoined) {
    return null;
  }

  async function sendNotice() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/session/delay-notice", {
        body: JSON.stringify({
          actorRole,
          bookingId,
          bookingVersion,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; notice: { sentAt: string } }
        | { ok: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        setError(
          payload?.ok === false && payload.error?.message
            ? payload.error.message
            : "Não foi possível enviar o aviso agora.",
        );
        return;
      }
      setSentAt(payload.notice.sentAt);
      setDialogOpen(false);
    } catch {
      setError("Não foi possível enviar o aviso agora.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl bg-brand-lavenderSoft p-4">
      {sentAt ? (
        <p className="flex items-center gap-2 text-sm font-extrabold text-brand-deep">
          <Clock3 aria-hidden="true" size={18} />
          Aviso enviado
        </p>
      ) : (
        <>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onClick={() => setDialogOpen(true)}
            type="button"
          >
            <Clock3 aria-hidden="true" size={18} />
            Vou me atrasar
          </button>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Avisaremos {actorRole === "patient" ? "seu terapeuta" : "seu paciente"}.
            O prazo para entrar não muda.
          </p>
        </>
      )}
      {dialogOpen ? (
        <TESDialog
          description="Envie um aviso para a outra pessoa antes de entrar."
          onClose={() => !submitting && setDialogOpen(false)}
          title="Avisar que vou me atrasar"
        >
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            Este aviso não pausa, reinicia ou amplia os dez minutos de tolerância
            para entrar {actorRole === "patient" ? "no encontro" : "na sessão"}.
            Não é necessário responder.
          </p>
          {error ? (
            <p className="mt-3 text-sm font-semibold text-status-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-3">
            <button
              className="min-h-11 rounded-lg border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary"
              disabled={submitting}
              onClick={() => setDialogOpen(false)}
              type="button"
            >
              Voltar
            </button>
            <button
              className="min-h-11 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white disabled:opacity-60"
              disabled={submitting}
              onClick={() => void sendNotice()}
              type="button"
            >
              {submitting ? "Enviando..." : "Enviar aviso"}
            </button>
          </div>
        </TESDialog>
      ) : null}
    </div>
  );
}
