"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { TESDialog } from "@/components/tes/tes-dialog";

type Status = {
  available: boolean;
  state: string;
  followup?: { requestId: string; reason: string };
};

export function AdminFullRefundAction({
  paymentId, amount, status,
}: { paymentId: string; amount: string; status: Status }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  const submittedReason = useRef<string | null>(null);

  async function submit(input: { reason: string; requestId: string }) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/payments/full-refund", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, ...input }),
      });
      const payload = await response.json() as {
        ok?: boolean; status?: string; message?: string;
      };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Não foi possível concluir agora. Confira o andamento antes de tentar novamente.");
        router.refresh();
        return;
      }
      setMessage(payload.status === "completed"
        ? "Reembolso registrado. Acompanhe a confirmação nesta página."
        : payload.status === "pending"
          ? "Solicitação registrada. Acompanhe a confirmação nesta página."
          : "O caso precisa de conferência da equipe antes de ser encerrado.");
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("Não foi possível consultar a situação. Confira o andamento antes de tentar novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-brand-lavender/60 bg-white p-5">
      <h2 className="text-lg font-extrabold text-brand-deep">Apoio ao cliente</h2>
      <p className="mt-2 text-sm leading-6 text-tesText-secondary">
        {status.available
          ? `Se a análise indicar reembolso, o valor integral da sessão (${amount}) pode ser solicitado aqui.`
          : status.followup
            ? "A solicitação já foi registrada. Continue a conferência até a confirmação final."
            : "Esta sessão não está disponível para uma solicitação de reembolso agora. Confira a situação financeira antes de tomar uma nova decisão."}
      </p>
      {status.available ? (
        <button className="mt-4 rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white"
          type="button" onClick={() => { requestId.current = crypto.randomUUID(); submittedReason.current = null; setReason(""); setMessage(""); setOpen(true); }}>
          Solicitar reembolso integral
        </button>
      ) : status.followup ? (
        <button className="mt-4 rounded-xl border border-brand-lavender px-5 py-3 text-sm font-bold text-brand-deep disabled:opacity-50"
          type="button" disabled={pending}
          onClick={() => void submit(status.followup!)}>
          {pending ? "Conferindo…" : "Continuar conferência"}
        </button>
      ) : null}
      <p aria-live="polite" className="mt-3 text-sm font-semibold text-tesText-secondary">{message}</p>
      {open ? (
        <TESDialog title="Confirmar reembolso integral" onClose={() => { if (!pending) setOpen(false); }}
          description="Esta decisão solicita a devolução do valor total ao cliente. Ela não pode ser desfeita pela plataforma.">
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            if (!requestId.current) requestId.current = crypto.randomUUID();
            if (!submittedReason.current) submittedReason.current = reason.trim();
            void submit({ reason: submittedReason.current, requestId: requestId.current });
          }}>
            <p className="text-sm font-semibold text-brand-deep">Valor total: {amount}</p>
            <label className="block text-sm font-bold text-brand-deep" htmlFor="full-refund-reason">
              Motivo da decisão
            </label>
            <textarea id="full-refund-reason" className="min-h-28 w-full rounded-xl border border-brand-lavender p-3 text-sm"
              minLength={20} maxLength={1000} required disabled={pending || submittedReason.current !== null}
              value={reason} onChange={(event) => setReason(event.target.value)}
              placeholder="Descreva o que foi apurado e por que a devolução é necessária." />
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" disabled={pending} onClick={() => setOpen(false)}
                className="rounded-xl border border-brand-lavender px-5 py-3 text-sm font-bold text-brand-deep">
                Voltar
              </button>
              <button type="submit" disabled={pending || reason.trim().length < 20}
                className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                {pending ? "Solicitando…" : "Confirmar devolução integral"}
              </button>
            </div>
          </form>
        </TESDialog>
      ) : null}
    </div>
  );
}
