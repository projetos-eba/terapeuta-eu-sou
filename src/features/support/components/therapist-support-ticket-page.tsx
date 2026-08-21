"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { routes } from "@/lib/routes";

import { supportTicketBodyLimit } from "../support-contracts";

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
  }>;
  protocol: string;
  resolvedAt: string | null;
  status: string;
  subject: string;
};

export function TherapistSupportTicketPage({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch(`/api/support/tickets/${ticketId}`, {
      cache: "no-store",
    });
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
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!body.trim()) {
      setError("Escreva uma resposta antes de enviar.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const response = await fetch(`/api/support/tickets/${ticketId}`, {
      body: JSON.stringify({ body, requestId: requestId.current }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      ok?: boolean;
    } | null;
    setIsSubmitting(false);
    if (!response.ok || !payload?.ok) {
      setError(
        payload?.error?.message ??
          "Não foi possível enviar sua resposta agora.",
      );
      return;
    }
    setBody("");
    requestId.current = null;
    await load();
  }

  return (
    <main className="mx-auto w-full max-w-[980px] pb-10 text-tesText-primary">
      <Link
        className="inline-flex min-h-11 items-center text-sm font-extrabold text-brand-primary"
        href={routes.therapist.messages}
      >
        ← Voltar para mensagens
      </Link>
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
                  message.author_role === "therapist"
                    ? "ml-auto max-w-[86%] rounded-2xl bg-brand-lavenderSoft p-4"
                    : "mr-auto max-w-[86%] rounded-2xl bg-surface-muted p-4"
                }
                key={message.id}
              >
                <p className="text-sm font-extrabold text-brand-deep">
                  {message.author_role === "admin" ? "Equipe TES" : "Você"}{" "}
                  <span className="ml-2 text-xs font-semibold text-tesText-secondary">
                    {date(message.created_at)}
                  </span>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-tesText-secondary">
                  {message.body}
                </p>
              </article>
            ))}
          </div>
          {ticket.status === "resolved" ? (
            <div className="border-t border-brand-lavender/70 px-5 py-5 sm:px-7">
              <p className="text-sm font-semibold text-tesText-secondary">
                Este chamado foi resolvido. Se ainda precisar de ajuda, envie
                uma nova mensagem para reabrir o atendimento.
              </p>
            </div>
          ) : null}
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
                disabled={isSubmitting || !body.trim()}
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
            {error ? (
              <p className="mt-3 rounded-lg bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger">
                {error}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
    </main>
  );
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
