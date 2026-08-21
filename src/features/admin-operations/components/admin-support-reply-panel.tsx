"use client";

import { useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

export function AdminSupportReplyPanel({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const requestId = useRef<string | null>(null);
  async function submit() {
    if (!body.trim()) return;
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    requestId.current ??= crypto.randomUUID();
    const response = await fetch(
      `/api/admin/support/tickets/${ticketId}/reply`,
      {
        body: JSON.stringify({ body, requestId: requestId.current }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      ok?: boolean;
    } | null;
    setIsSubmitting(false);
    if (!response.ok || !payload?.ok) {
      setError(
        payload?.error?.message ?? "Não foi possível enviar a resposta agora.",
      );
      return;
    }
    setBody("");
    requestId.current = null;
    setSuccess(true);
  }
  return (
    <div className="space-y-3">
      <label className="grid gap-2">
        <span className="text-sm font-extrabold text-brand-deep">
          Resposta pública
        </span>
        <textarea
          className="min-h-28 w-full resize-y rounded-xl border border-brand-lavender px-3 py-3 text-sm font-semibold leading-6 text-brand-deep"
          disabled={isSubmitting}
          maxLength={4000}
          onChange={(event) => {
            setBody(event.target.value);
            requestId.current = null;
          }}
          placeholder="Escreva uma resposta visível ao solicitante."
          value={body}
        />
      </label>
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-primary px-4 text-sm font-extrabold text-white disabled:opacity-60"
        disabled={!body.trim() || isSubmitting}
        onClick={() => void submit()}
        type="button"
      >
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={16} />
        ) : (
          <Send aria-hidden="true" size={16} />
        )}{" "}
        Enviar resposta
      </button>
      {success ? (
        <p className="text-sm font-bold text-status-success">
          Resposta enviada ao solicitante.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-bold text-status-danger">{error}</p>
      ) : null}
    </div>
  );
}
