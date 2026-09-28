"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { TESDialog } from "@/components/tes/tes-dialog";

type ManagementState = {
  available: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
};

export function AdminSubscriptionCancelAction({
  subscriptionId,
  status,
}: {
  subscriptionId: string;
  status: ManagementState;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);

  async function submit() {
    if (reason.trim().length < 20) {
      setMessage("Explique o motivo com pelo menos 20 caracteres.");
      return;
    }

    if (!requestId.current) requestId.current = crypto.randomUUID();
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/assinaturas/cancelar", {
        body: JSON.stringify({
          reason: reason.trim(),
          requestId: requestId.current,
          subscriptionId,
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        setMessage(
          payload?.message ??
            "Não foi possível concluir agora. Confira a situação antes de tentar novamente.",
        );
        router.refresh();
        return;
      }

      setOpen(false);
      setMessage(
        "Cancelamento programado. A assinatura permanece ativa até o fim do ciclo atual.",
      );
      router.refresh();
    } catch {
      setMessage(
        "Não foi possível consultar a situação agora. Confira o andamento antes de tentar novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  if (status.cancelAtPeriodEnd) {
    return (
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        O cancelamento já está programado
        {status.currentPeriodEnd ? ` para ${status.currentPeriodEnd}` : ""}. A
        assinatura segue ativa até essa data.
      </p>
    );
  }

  if (!status.available) {
    return (
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        Esta assinatura não está disponível para cancelamento neste momento.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        O cancelamento é programado para o fim do ciclo atual. O acesso pago
        permanece disponível até lá.
      </p>
      <button
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-status-danger px-4 text-sm font-extrabold text-white outline-none transition hover:brightness-95 focus-visible:ring-4 focus-visible:ring-ring/20"
        onClick={() => {
          requestId.current = crypto.randomUUID();
          setReason("");
          setMessage("");
          setOpen(true);
        }}
        type="button"
      >
        Cancelar assinatura
      </button>
      <p
        aria-live="polite"
        className="mt-3 text-sm font-semibold text-tesText-secondary"
      >
        {message}
      </p>
      {open ? (
        <TESDialog
          description="O cancelamento será aplicado ao fim do ciclo atual. Essa decisão fica registrada para acompanhamento administrativo."
          onClose={() => {
            if (!pending) setOpen(false);
          }}
          title="Confirmar cancelamento da assinatura"
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
                Motivo do cancelamento
              </span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-brand-lavender bg-white p-3 text-sm font-semibold text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
                disabled={pending}
                maxLength={1000}
                minLength={20}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Descreva a decisão para que a equipe possa acompanhá-la."
                required
                value={reason}
              />
              <span className="mt-2 block text-xs font-semibold text-tesText-muted">
                Mínimo de 20 caracteres.
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
                disabled={pending || reason.trim().length < 20}
                type="submit"
              >
                {pending ? "Programando…" : "Confirmar cancelamento"}
              </button>
            </div>
          </form>
        </TESDialog>
      ) : null}
    </div>
  );
}
