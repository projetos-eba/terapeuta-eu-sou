"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { Headphones, Loader2, MessageSquarePlus } from "lucide-react";

import { TESDialog } from "@/components/tes/tes-dialog";
import { routes } from "@/lib/routes";

import {
  supportTicketBodyLimit,
  supportTicketCategories,
  type SupportTicketCategory,
} from "../support-contracts";

type Ticket = {
  category: string;
  createdAt: string;
  id: string;
  lastActivityAt: string;
  status: string;
  subject: string;
};

const categoryLabels: Record<SupportTicketCategory, string> = {
  agenda_sessoes: "Agenda e sessões",
  zoom_acesso: "Zoom e acesso à sessão",
  pagamentos: "Pagamentos",
  financeiro_repasses: "Financeiro e repasses",
  plano_assinatura: "Plano e assinatura",
  perfil_verificacao: "Perfil e verificação",
  conta_acesso: "Conta e acesso",
  outro: "Outro assunto",
};

export function TherapistSupportSection({ tickets }: { tickets: Ticket[] }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section className="rounded-card border border-brand-lavender bg-white shadow-card">
      <header className="flex flex-col gap-3 border-b border-brand-lavender/70 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-light italic text-brand-deep">
            Suporte TES
          </h2>
          <p className="mt-1 max-w-md text-sm font-semibold leading-6 text-tesText-secondary">
            Converse com nossa equipe sobre sessões, financeiro, conta e
            funcionamento da plataforma.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-primary px-4 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <MessageSquarePlus aria-hidden="true" size={17} />
          Novo chamado
        </button>
      </header>

      {tickets.length ? (
        <div className="divide-y divide-brand-lavender/70">
          {tickets.map((ticket) => (
            <Link
              className="grid min-h-[106px] grid-cols-[44px_minmax(0,1fr)] gap-3 px-5 py-4 transition hover:bg-brand-lavenderSoft/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary sm:grid-cols-[44px_minmax(0,1fr)_auto]"
              href={routes.therapist.supportTicketDetail(ticket.id)}
              key={ticket.id}
            >
              <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                <Headphones aria-hidden="true" size={19} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-sm text-brand-deep">
                    {ticket.subject}
                  </strong>
                  <Status status={ticket.status} />
                </span>
                <span className="mt-1 block text-sm font-semibold text-tesText-secondary">
                  {categoryLabels[ticket.category as SupportTicketCategory] ??
                    "Suporte TES"}
                </span>
                <span className="mt-2 block text-xs font-semibold text-tesText-secondary">
                  Protocolo {ticket.id.slice(0, 8).toUpperCase()} ·{" "}
                  {formatDate(ticket.lastActivityAt)}
                </span>
              </span>
              <span className="col-start-2 text-sm font-extrabold text-brand-primary sm:col-start-auto sm:self-center">
                Acompanhar
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-5 py-10 text-center">
          <h3 className="text-base font-extrabold text-brand-deep">
            Nenhum chamado aberto
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-tesText-secondary">
            Quando precisar de ajuda com sua conta, sessões ou financeiro, você
            poderá acompanhar tudo por aqui.
          </p>
        </div>
      )}
      {isOpen ? <NewTicketDialog onClose={() => setIsOpen(false)} /> : null}
    </section>
  );
}

function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState<SupportTicketCategory>("outro");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestId = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!subject.trim() || !description.trim()) {
      setError("Preencha o assunto e conte o que aconteceu.");
      return;
    }
    setIsSubmitting(true);
    requestId.current ??= crypto.randomUUID();
    const response = await fetch("/api/support/tickets", {
      body: JSON.stringify({
        bookingId: null,
        category,
        description,
        requestId: requestId.current,
        source: "message_center",
        subject,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      ok?: boolean;
      ticket?: { id: string };
    } | null;
    setIsSubmitting(false);
    if (!response.ok || !payload?.ok || !payload.ticket) {
      setError(
        payload?.error?.message ?? "Não foi possível abrir o chamado agora.",
      );
      return;
    }
    router.push(routes.therapist.supportTicketDetail(payload.ticket.id));
    router.refresh();
    onClose();
  }

  return (
    <TESDialog
      description="Inclua as informações necessárias para entendermos o problema. Evite compartilhar dados sensíveis desnecessariamente."
      onClose={onClose}
      title="Novo chamado"
    >
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-2">
          <span className="text-sm font-extrabold text-brand-deep">
            Categoria
          </span>
          <select
            className="min-h-12 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-semibold text-brand-deep"
            onChange={(event) =>
              setCategory(event.target.value as SupportTicketCategory)
            }
            value={category}
          >
            {supportTicketCategories.map((value) => (
              <option key={value} value={value}>
                {categoryLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-extrabold text-brand-deep">
            Assunto
          </span>
          <input
            className="min-h-12 rounded-lg border border-brand-lavender px-3 text-sm font-semibold text-brand-deep"
            maxLength={120}
            onChange={(event) => {
              setSubject(event.target.value);
              requestId.current = null;
            }}
            placeholder="Ex.: Dúvida sobre repasse da sessão"
            value={subject}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-extrabold text-brand-deep">
            Conte mais sobre o que aconteceu
          </span>
          <textarea
            className="min-h-36 w-full resize-y rounded-lg border border-brand-lavender px-3 py-3 text-sm font-semibold leading-6 text-brand-deep"
            maxLength={supportTicketBodyLimit}
            onChange={(event) => {
              setDescription(event.target.value);
              requestId.current = null;
            }}
            value={description}
          />
          <span className="text-xs font-semibold text-tesText-secondary">
            {description.length}/{supportTicketBodyLimit}
          </span>
        </label>
        {error ? (
          <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-full border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={17} />
            ) : null}{" "}
            Abrir chamado
          </button>
        </div>
      </form>
    </TESDialog>
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
    <span className="rounded-full bg-brand-lavenderSoft px-2.5 py-1 text-[11px] font-extrabold text-brand-primary">
      {labels[status] ?? "Em atendimento"}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
