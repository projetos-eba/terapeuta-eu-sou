"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";

import { TESFeedbackDialog } from "@/components/tes";
import {
  supportTicketAttachmentLimit,
  supportTicketAttachmentMimeTypes,
  supportTicketAttachmentSizeLimit,
} from "@/features/support/support-contracts";

export function AdminSupportReplyPanel({
  onSuccess,
  ticketId,
}: {
  onSuccess?: () => void;
  ticketId: string;
}) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const requestId = useRef<string | null>(null);
  async function submit() {
    if (!body.trim() && attachments.length === 0) return;
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    requestId.current ??= crypto.randomUUID();
    const formData = new FormData();
    formData.set("body", body);
    formData.set("requestId", requestId.current);
    for (const file of attachments) formData.append("attachments", file);
    const response = await fetch(
      `/api/admin/support/tickets/${ticketId}/reply`,
      {
        body: formData,
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
    setAttachments([]);
    requestId.current = null;
    setSuccess(true);
    onSuccess?.();
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
      <label className="grid gap-2">
        <span className="text-sm font-extrabold text-brand-deep">
          Anexos (opcional)
        </span>
        <span className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-brand-primary px-3 text-sm font-bold text-brand-primary">
          <Paperclip aria-hidden="true" size={16} />
          Adicionar PDF ou imagem
          <input
            accept={supportTicketAttachmentMimeTypes.join(",")}
            className="sr-only"
            multiple
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              if (
                selected.some(
                  (file) =>
                    !supportTicketAttachmentMimeTypes.includes(
                      file.type as (typeof supportTicketAttachmentMimeTypes)[number],
                    ) || file.size > supportTicketAttachmentSizeLimit,
                )
              ) {
                setError("Use até 5 arquivos PDF ou imagens de até 10 MB.");
              } else {
                setAttachments((current) =>
                  [...current, ...selected].slice(
                    0,
                    supportTicketAttachmentLimit,
                  ),
                );
              }
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </span>
        {attachments.length > 0 ? (
          <div className="grid gap-2">
            {attachments.map((file, index) => (
              <span
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2 text-xs font-bold text-tesText-secondary"
                key={`${file.name}-${file.lastModified}-${index}`}
              >
                <span className="truncate">{file.name}</span>
                <button
                  aria-label={`Remover ${file.name}`}
                  className="text-brand-primary"
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" size={15} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </label>
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-primary px-4 text-sm font-extrabold text-white disabled:opacity-60"
        disabled={(!body.trim() && attachments.length === 0) || isSubmitting}
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
        <TESFeedbackDialog message={error} onClose={() => setError(null)} />
      ) : null}
    </div>
  );
}
