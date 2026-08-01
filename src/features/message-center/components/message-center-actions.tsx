"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, MessageSquarePlus } from "lucide-react";

import { TESDialog } from "@/components/tes/tes-dialog";

import type {
  MessageCenterActorRole,
  MessageCenterTemplate,
  MessageCenterThread,
} from "../message-center.types";

type MessageCenterActionsProps = {
  actorRole: MessageCenterActorRole;
  source: "demo" | "supabase";
  templates: MessageCenterTemplate[];
  threads: MessageCenterThread[];
  variant: "participant" | "support";
};

type ApiFailure = {
  ok: false;
  error?: {
    message?: string;
  };
};

type SupportTicketResponse =
  | ApiFailure
  | {
      ok: true;
      ticket: {
        id: string;
        protocol: string;
        status: string;
      };
    };

export function MessageCenterActions({
  actorRole,
  source,
  templates,
  threads,
  variant,
}: MessageCenterActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-xs font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <MessageSquarePlus aria-hidden="true" size={16} />
        {variant === "support" ? "Novo suporte" : "Enviar template"}
      </button>

      {isOpen ? (
        <TemplateDialog
          actorRole={actorRole}
          onClose={() => setIsOpen(false)}
          source={source}
          templates={templates}
          threads={threads}
          variant={variant}
        />
      ) : null}
    </>
  );
}

function TemplateDialog({
  actorRole,
  onClose,
  source,
  templates,
  threads,
  variant,
}: MessageCenterActionsProps & { onClose: () => void }) {
  const firstThread = useMemo(
    () => threads.find((thread) => Boolean(thread.conversationId)) ?? null,
    [threads],
  );
  const [conversationId, setConversationId] = useState(
    firstThread?.conversationId ?? "",
  );
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const supportRequestIdRef = useRef<string | null>(null);
  const selectedTemplate = templates.find(
    (template) => template.key === templateKey,
  );
  const canSubmit =
    variant === "support" || (Boolean(conversationId) && Boolean(templateKey));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedTemplate || !canSubmit) return;

    if (variant === "support") {
      if (source === "demo") {
        setError("Conecte-se novamente para abrir um chamado real.");
        return;
      }

      setIsSubmitting(true);
      supportRequestIdRef.current =
        supportRequestIdRef.current ?? crypto.randomUUID();

      const response = await fetch("/api/support/tickets", {
        body: JSON.stringify({
          actorRole,
          requestId: supportRequestIdRef.current,
          source: "message_center",
          templateKey,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as SupportTicketResponse | null;

      setIsSubmitting(false);

      if (!response.ok || payload?.ok !== true) {
        setError(
          payload?.ok === false && payload.error?.message
            ? payload.error.message
            : "Não foi possível abrir o chamado agora.",
        );
        return;
      }

      setProtocol(payload.ticket.protocol);
      setStatus("success");
      return;
    }

    if (source === "demo") {
      setError("Conecte-se novamente para enviar um template real.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/messages/send-template", {
      body: JSON.stringify({
        actorRole,
        conversationId,
        templateKey,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiFailure
      | { ok: true }
      | null;

    setIsSubmitting(false);

    if (!response.ok || payload?.ok !== true) {
      setError(
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : "Não foi possível enviar este template agora.",
      );
      return;
    }

    setStatus("success");
  }

  return (
    <TESDialog
      description={
        variant === "support"
          ? "Escolha uma categoria para acionar a plataforma sem texto livre."
          : "Escolha uma pessoa e um modelo aprovado para enviar pela plataforma."
      }
      onClose={onClose}
      title={
        variant === "support" ? "Novo contato com suporte" : "Enviar template"
      }
    >
      {status === "success" ? (
        <div className="rounded-xl bg-status-successBg p-5 text-status-success">
          <Check aria-hidden="true" size={22} />
          <p className="mt-3 text-sm font-extrabold">
            Template selecionado com segurança.
          </p>
          <p className="mt-1 text-sm font-semibold leading-6">
            {variant === "support"
              ? `Chamado aberto com protocolo ${protocol ?? "registrado"}. Acompanhe a resposta por esta central.`
              : "A mensagem enviada usa apenas o texto pré-aprovado."}
          </p>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {variant === "participant" ? (
            <label className="grid gap-2">
              <span className="text-sm font-extrabold text-brand-deep">
                Destinatário
              </span>
              <span className="relative">
                <select
                  className="min-h-12 w-full appearance-none rounded-lg border border-brand-lavender bg-white px-4 pr-10 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  onChange={(event) => setConversationId(event.target.value)}
                  value={conversationId}
                >
                  {threads.map((thread) => (
                    <option
                      disabled={!thread.conversationId}
                      key={thread.id}
                      value={thread.conversationId ?? ""}
                    >
                      {thread.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary"
                  size={17}
                />
              </span>
            </label>
          ) : null}

          <fieldset className="grid gap-2">
            <legend className="text-sm font-extrabold text-brand-deep">
              Template
            </legend>
            <div className="grid gap-2">
              {templates.map((template) => (
                <label
                  className="grid cursor-pointer gap-1 rounded-lg border border-brand-lavender bg-white p-4 transition has-[:checked]:border-brand-primary has-[:checked]:bg-brand-lavenderSoft"
                  key={template.key}
                >
                  <span className="flex items-center gap-3">
                    <input
                      checked={templateKey === template.key}
                      className="size-4 accent-brand-primary"
                      onChange={() => setTemplateKey(template.key)}
                      type="radio"
                    />
                    <span className="text-sm font-extrabold text-brand-deep">
                      {template.label}
                    </span>
                  </span>
                  <span className="pl-7 text-xs font-semibold leading-5 text-tesText-secondary">
                    {template.body}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error ? (
            <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
              onClick={onClose}
              type="button"
            >
              Voltar
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit || isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={17}
                />
              ) : null}
              {variant === "support"
                ? "Selecionar categoria"
                : "Enviar template"}
            </button>
          </div>
        </form>
      )}
    </TESDialog>
  );
}
