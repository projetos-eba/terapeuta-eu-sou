"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { TESDialog } from "@/components/tes/tes-dialog";

export function AdminSessionPrechargeCancelAction({
  bookingId,
}: {
  bookingId: string;
}) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 8 || normalizedReason.length > 500) {
      setMessage("Informe uma justificativa entre 8 e 500 caracteres.");
      return;
    }

    if (!requestId.current) requestId.current = crypto.randomUUID();
    setPending(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/sessoes/cancelar-antes-da-cobranca",
        {
          body: JSON.stringify({
            bookingId,
            reason: normalizedReason,
            requestId: requestId.current,
          }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        setMessage(
          payload?.message ??
            "Não foi possível cancelar esta sessão agora. Atualize a página para conferir a situação.",
        );
        router.refresh();
        return;
      }

      setOpen(false);
      setMessage("Sessão cancelada antes da cobrança.");
      router.refresh();
    } catch {
      setMessage(
        "Não foi possível concluir o cancelamento agora. Atualize a página e tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-status-warning/30 bg-status-warningBg p-5 shadow-card">
      <h2 className="text-lg font-extrabold text-brand-deep">
        Cancelamento antes da cobrança
      </h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
        Esta reserva ainda não iniciou a cobrança e pode ser cancelada com
        segurança. Nenhum valor será cobrado por esta sessão.
      </p>
      <button
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-status-danger px-4 text-sm font-extrabold text-white outline-none transition hover:brightness-95 focus-visible:ring-4 focus-visible:ring-ring/20"
        onClick={() => {
          requestId.current = crypto.randomUUID();
          setReason("");
          setMessage("");
          setOpen(true);
        }}
        type="button"
      >
        Cancelar sessão
      </button>
      <p aria-live="polite" className="mt-3 text-sm font-semibold text-tesText-secondary">
        {message}
      </p>

      {open ? (
        <TESDialog
          description="A sessão será cancelada antes de qualquer cobrança. Nenhum valor será cobrado ou devolvido por esta reserva."
          onClose={() => {
            if (!pending) setOpen(false);
          }}
          title="Confirmar cancelamento da sessão"
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="block">
              <span className="text-sm font-extrabold text-brand-deep">
                Justificativa administrativa
              </span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-brand-lavender bg-white p-3 text-sm font-semibold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                disabled={pending}
                maxLength={500}
                minLength={8}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explique brevemente por que a reserva precisa ser cancelada."
                required
                value={reason}
              />
              <span className="mt-2 block text-xs font-semibold text-tesText-muted">
                Mínimo de 8 caracteres.
              </span>
            </label>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
              >
                Voltar
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-status-danger px-4 text-sm font-extrabold text-white outline-none transition hover:brightness-95 focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pending || reason.trim().length < 8}
                type="submit"
              >
                {pending ? "Cancelando…" : "Confirmar cancelamento"}
              </button>
            </div>
          </form>
        </TESDialog>
      ) : null}
    </section>
  );
}
