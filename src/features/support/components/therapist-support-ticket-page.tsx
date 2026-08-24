"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";

import { TESFeedbackDialog } from "@/components/tes";
import { routes } from "@/lib/routes";
import { useSupportLiveRefresh } from "./support-live-refresh";

import {
  supportTicketAttachmentLimit,
  supportTicketAttachmentMimeTypes,
  supportTicketAttachmentSizeLimit,
  supportTicketBodyLimit,
  type SupportTicketAttachment,
} from "../support-contracts";

type Ticket = {
  bookingId: string | null;
  category: string;
  createdAt: string;
  id: string;
  lastActivityAt: string;
  messages: Array<{
    author_role: "admin" | "patient" | "requester" | "therapist";
    body: string;
    created_at: string;
    id: string;
    attachments?: SupportTicketAttachment[];
  }>;
  protocol: string;
  resolvedAt: string | null;
  status: string;
  subject: string;
};

export function SupportTicketPage({
  actorRole,
  ticketId,
}: {
  actorRole: "patient" | "therapist";
  ticketId: string;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const requestId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch(
      `/api/support/tickets/${ticketId}?role=${actorRole}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      ticket?: Ticket;
    } | null;
    if (!response.ok || !payload?.ticket)
      setError(
        payload?.error?.message ??
          "Não foi possível carregar este chamado agora.",
      );
    else {
      setTicket(payload.ticket);
      setError(null);
    }
    setIsLoading(false);
  }, [actorRole, ticketId]);

  useEffect(() => {
    void load();
  }, [load]);
  useSupportLiveRefresh({ actorRole, onRefresh: load, ticketId });

  async function send() {
    if (!body.trim() && attachments.length === 0) {
      setFeedback("Escreva uma resposta ou adicione um anexo antes de enviar.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setFeedback(null);
    requestId.current ??= crypto.randomUUID();
    const formData = new FormData();
    formData.set("actorRole", actorRole);
    formData.set("body", body);
    formData.set("requestId", requestId.current);
    for (const file of attachments) formData.append("attachments", file);
    const response = await fetch(`/api/support/tickets/${ticketId}`, {
      body: formData,
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      ok?: boolean;
    } | null;
    setIsSubmitting(false);
    if (!response.ok || !payload?.ok) {
      setFeedback(
        payload?.error?.message ??
          "Não foi possível enviar sua resposta agora.",
      );
      return;
    }
    setBody("");
    setAttachments([]);
    requestId.current = null;
    await load();
  }

  const isRequesterMessage = (
    authorRole: Ticket["messages"][number]["author_role"],
  ) => authorRole === actorRole || authorRole === "requester";

  return (
    <main className="mx-auto w-full max-w-[980px] pb-10 text-tesText-primary">
      <Link
        className="inline-flex min-h-11 items-center text-sm font-extrabold text-brand-primary"
        href={
          actorRole === "patient"
            ? routes.patient.messages
            : routes.therapist.messages
        }
      >
        ← Voltar para mensagens
      </Link>
      {feedback ? (
        <TESFeedbackDialog
          message={feedback}
          onClose={() => setFeedback(null)}
        />
      ) : null}
      {isLoading ? (
        <p className="mt-6 rounded-card border border-brand-lavender bg-white p-6 text-sm font-semibold text-tesText-secondary">
          Carregando chamado…
        </p>
      ) : null}
      {error && !ticket ? (
        <p className="mt-6 rounded-card bg-status-dangerBg p-6 text-sm font-bold text-status-danger">
          {error}
        </p>
      ) : null}
      {ticket ? (
        <section className="mt-5 rounded-card border border-brand-lavender bg-white shadow-card">
          <header className="border-b border-brand-lavender/70 px-5 py-6 sm:px-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-primary">
              Protocolo {ticket.protocol}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-light italic text-brand-deep">
                {ticket.subject}
              </h1>
              <Status status={ticket.status} />
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
              {categoryLabel(ticket.category)} · Aberto em{" "}
              {date(ticket.createdAt)}
              {ticket.bookingId ? " · Relacionado a uma sessão" : ""}
            </p>
          </header>
          <div className="space-y-4 px-5 py-6 sm:px-7">
            {ticket.messages.map((message) => (
              <article
                className={
                  isRequesterMessage(message.author_role)
                    ? "ml-auto max-w-[86%] rounded-2xl bg-brand-lavenderSoft p-4"
                    : "mr-auto max-w-[86%] rounded-2xl bg-surface-muted p-4"
                }
                key={message.id}
              >
                <p className="text-sm font-extrabold text-brand-deep">
                  {isRequesterMessage(message.author_role)
                    ? "Você"
                    : "Equipe TES"}{" "}
                  <span className="ml-2 text-xs font-semibold text-tesText-secondary">
                    {date(message.created_at)}
                  </span>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-tesText-secondary">
                  {message.body}
                </p>
                {message.attachments?.length ? (
                  <div className="mt-3 grid gap-2">
                    {message.attachments.map((attachment) => (
                      <a
                        className="flex items-center gap-2 rounded-lg border border-brand-lavender bg-white px-3 py-2 text-xs font-extrabold text-brand-primary hover:bg-brand-lavenderSoft"
                        download={attachment.fileName}
                        href={attachment.downloadPath}
                        key={attachment.id}
                      >
                        <Paperclip aria-hidden="true" size={14} />
                        <span className="min-w-0 truncate">
                          {attachment.fileName}
                        </span>
                        <span className="ml-auto shrink-0 font-semibold text-tesText-secondary">
                          {formatBytes(attachment.sizeBytes)}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {ticket.status === "resolved" && !isReopening ? (
            <div className="border-t border-brand-lavender/70 px-5 py-5 sm:px-7">
              <p className="text-sm font-semibold text-tesText-secondary">
                Este chamado foi resolvido. Se ainda precisar de ajuda, você
                pode reabrir o atendimento com uma nova mensagem.
              </p>
              <button
                className="mt-4 inline-flex min-h-11 items-center rounded-full border border-brand-primary px-5 text-sm font-extrabold text-brand-primary"
                onClick={() => setIsReopening(true)}
                type="button"
              >
                Ainda preciso de ajuda
              </button>
            </div>
          ) : null}
          {ticket.status !== "resolved" || isReopening ? (
            <form
              className="border-t border-brand-lavender/70 px-5 py-5 sm:px-7"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="grid gap-2">
                <span className="text-sm font-extrabold text-brand-deep">
                  Responder ao suporte
                </span>
                <textarea
                  className="min-h-32 w-full resize-y rounded-xl border border-brand-lavender px-4 py-3 text-sm font-semibold leading-6 text-brand-deep"
                  disabled={isSubmitting}
                  maxLength={supportTicketBodyLimit}
                  onChange={(event) => {
                    setBody(event.target.value);
                    requestId.current = null;
                  }}
                  placeholder="Conte o que precisa complementar…"
                  value={body}
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-tesText-secondary">
                  {body.length}/{supportTicketBodyLimit}
                </span>
                <button
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white disabled:opacity-60"
                  disabled={
                    isSubmitting || (!body.trim() && attachments.length === 0)
                  }
                  type="submit"
                >
                  {isSubmitting ? (
                    <Loader2
                      aria-hidden="true"
                      className="animate-spin"
                      size={16}
                    />
                  ) : (
                    <Send aria-hidden="true" size={16} />
                  )}{" "}
                  Enviar resposta
                </button>
              </div>
              <label className="mt-4 grid gap-2">
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
                      const invalid = selected.some(
                        (file) =>
                          !supportTicketAttachmentMimeTypes.includes(
                            file.type as (typeof supportTicketAttachmentMimeTypes)[number],
                          ) || file.size > supportTicketAttachmentSizeLimit,
                      );
                      if (invalid) {
                        setFeedback(
                          "Use até 5 arquivos PDF ou imagens de até 10 MB.",
                        );
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
                          className="shrink-0 text-brand-primary"
                          onClick={() =>
                            setAttachments((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
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
              {error ? (
                <p className="mt-3 rounded-lg bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger">
                  {error}
                </p>
              ) : null}
            </form>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export function TherapistSupportTicketPage({ ticketId }: { ticketId: string }) {
  return <SupportTicketPage actorRole="therapist" ticketId={ticketId} />;
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = {
    open: "Aberto",
    in_progress: "Em atendimento",
    waiting_requester: "Aguardando você",
    waiting_support: "Aguardando TES",
    resolved: "Resolvido",
  };
  return (
    <span className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs font-extrabold text-brand-primary">
      {labels[status] ?? "Em atendimento"}
    </span>
  );
}
function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    agenda_sessoes: "Agenda e sessões",
    zoom_acesso: "Zoom e acesso à sessão",
    pagamentos: "Pagamentos",
    financeiro_repasses: "Financeiro e repasses",
    plano_assinatura: "Plano e assinatura",
    perfil_verificacao: "Perfil e verificação",
    conta_acesso: "Conta e acesso",
    outro: "Outro assunto",
  };
  return labels[value] ?? "Suporte TES";
}
function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
