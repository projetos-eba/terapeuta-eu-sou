"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import {
  ChevronRight,
  Headphones,
  Loader2,
  MessageSquarePlus,
} from "lucide-react";

import { TESDialog, TESFeedbackDialog } from "@/components/tes";
import { routes } from "@/lib/routes";
import type { MessageCenterPagination } from "@/features/message-center/message-center.types";

import {
  supportTicketBodyLimit,
  supportTicketCategories,
  type SupportTicketCategory,
} from "../support-contracts";
import {
  formatSupportTicketActivity,
  formatSupportTicketProtocol,
  getSupportTicketCategoryLabel,
} from "../support-ticket-presentation";
import { SupportTicketStatusBadge } from "./support-ticket-status-badge";

type Ticket = {
  category: string;
  createdAt: string;
  excerpt: string;
  id: string;
  lastActivityAt: string;
  protocol: string;
  status: string;
  subject: string;
};

export function SupportTicketSection({
  actorRole,
  conversationPage = 1,
  pagination,
  tickets,
}: {
  actorRole: "patient" | "therapist";
  conversationPage?: number;
  pagination?: MessageCenterPagination;
  tickets: Ticket[];
}) {
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
        <div
          aria-label="Tabela de chamados"
          className="divide-y divide-brand-lavender/70"
          role="table"
        >
          {tickets.map((ticket) => (
            <Link
              className="grid min-h-[106px] grid-cols-[44px_minmax(0,1fr)] gap-3 px-5 py-4 transition hover:bg-brand-lavenderSoft/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary sm:grid-cols-[44px_minmax(0,1fr)_auto]"
              href={
                actorRole === "patient"
                  ? routes.patient.supportTicketDetail(ticket.id)
                  : routes.therapist.supportTicketDetail(ticket.id)
              }
              key={ticket.id}
              role="row"
            >
              <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                <Headphones aria-hidden="true" size={19} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-sm text-brand-deep">
                    {ticket.subject}
                  </strong>
                  <SupportTicketStatusBadge
                    status={ticket.status}
                    viewer="requester"
                  />
                </span>
                <span className="mt-1 block text-sm font-semibold text-tesText-secondary">
                  {getSupportTicketCategoryLabel(ticket.category)}
                </span>
                <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-6 text-tesText-secondary">
                  {ticket.excerpt}
                </span>
                <span className="mt-2 block text-xs font-semibold text-tesText-secondary">
                  {formatSupportTicketActivity(ticket.lastActivityAt)} ·{" "}
                  {formatSupportTicketProtocol(ticket.protocol)}
                </span>
              </span>
              <span className="col-start-2 inline-flex items-center gap-1 text-sm font-extrabold text-brand-primary sm:col-start-auto sm:self-center">
                Acompanhar <ChevronRight aria-hidden="true" size={16} />
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
      {pagination ? (
        <SupportTicketPagination
          actorRole={actorRole}
          conversationPage={conversationPage}
          pagination={pagination}
        />
      ) : null}
      {isOpen ? (
        <NewSupportTicketDialog
          actorRole={actorRole}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </section>
  );
}

export function TherapistSupportSection({
  conversationPage,
  pagination,
  tickets,
}: {
  conversationPage?: number;
  pagination?: MessageCenterPagination;
  tickets: Ticket[];
}) {
  return (
    <SupportTicketSection
      actorRole="therapist"
      conversationPage={conversationPage}
      pagination={pagination}
      tickets={tickets}
    />
  );
}

function SupportTicketPagination({
  actorRole,
  conversationPage,
  pagination,
}: {
  actorRole: "patient" | "therapist";
  conversationPage: number;
  pagination: MessageCenterPagination;
}) {
  const baseHref =
    actorRole === "patient"
      ? routes.patient.messages
      : routes.therapist.messages;
  const first =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(
    pagination.total,
    pagination.page * pagination.pageSize,
  );
  const makeHref = (supportPage: number) => {
    const params = new URLSearchParams();
    if (conversationPage > 1) {
      params.set("conversationPage", String(conversationPage));
    }
    if (supportPage > 1) params.set("supportPage", String(supportPage));
    const query = params.toString();
    return query ? `${baseHref}?${query}` : baseHref;
  };

  return (
    <nav
      aria-label="Paginação de chamados"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-lavender/70 px-5 py-4"
    >
      <p className="text-xs font-semibold text-tesText-secondary">
        {first}-{last} de {pagination.total} chamados
      </p>
      <div className="flex items-center gap-2">
        {pagination.page > 1 ? (
          <Link
            className="inline-flex min-h-10 items-center rounded-full border border-brand-lavender px-4 text-xs font-extrabold text-brand-primary"
            href={makeHref(pagination.page - 1)}
          >
            Anterior
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex min-h-10 items-center rounded-full border border-brand-lavender px-4 text-xs font-extrabold text-tesText-secondary/60"
          >
            Anterior
          </span>
        )}
        {pagination.hasNext ? (
          <Link
            className="inline-flex min-h-10 items-center rounded-full bg-brand-primary px-4 text-xs font-extrabold text-white"
            href={makeHref(pagination.page + 1)}
          >
            Próxima
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex min-h-10 items-center rounded-full bg-brand-primary/40 px-4 text-xs font-extrabold text-white"
          >
            Próxima
          </span>
        )}
      </div>
    </nav>
  );
}

export type CreatedSupportTicket = {
  id: string;
  protocol: string;
};

export function NewSupportTicketDialog({
  actorRole,
  onClose,
  onTicketCreated,
}: {
  actorRole: "patient" | "therapist";
  onClose: () => void;
  onTicketCreated?: (ticket: CreatedSupportTicket) => void;
}) {
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
        actorRole,
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
      ticket?: { id: string; protocol: string };
    } | null;
    setIsSubmitting(false);
    if (!response.ok || !payload?.ok || !payload.ticket) {
      setError(
        payload?.error?.message ?? "Não foi possível abrir o chamado agora.",
      );
      return;
    }
    if (onTicketCreated) {
      onTicketCreated(payload.ticket);
      return;
    }
    router.push(
      actorRole === "patient"
        ? routes.patient.supportTicketDetail(payload.ticket.id)
        : routes.therapist.supportTicketDetail(payload.ticket.id),
    );
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
        <label className="grid gap-2" htmlFor="support-ticket-category">
          <span className="text-sm font-extrabold text-brand-deep">
            Categoria
          </span>
          <select
            className="min-h-12 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-semibold text-brand-deep"
            id="support-ticket-category"
            onChange={(event) =>
              setCategory(event.target.value as SupportTicketCategory)
            }
            value={category}
          >
            {supportTicketCategories.map((value) => (
              <option key={value} value={value}>
                {getSupportTicketCategoryLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2" htmlFor="support-ticket-subject">
          <span className="text-sm font-extrabold text-brand-deep">
            Assunto
          </span>
          <input
            className="min-h-12 rounded-lg border border-brand-lavender px-3 text-sm font-semibold text-brand-deep"
            id="support-ticket-subject"
            maxLength={120}
            onChange={(event) => {
              setSubject(event.target.value);
              requestId.current = null;
            }}
            placeholder="Ex.: Dúvida sobre repasse da sessão"
            value={subject}
          />
        </label>
        <label className="grid gap-2" htmlFor="support-ticket-description">
          <span className="text-sm font-extrabold text-brand-deep">
            Conte mais sobre o que aconteceu
          </span>
          <textarea
            className="min-h-36 w-full resize-y rounded-lg border border-brand-lavender px-3 py-3 text-sm font-semibold leading-6 text-brand-deep"
            id="support-ticket-description"
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
          <TESFeedbackDialog message={error} onClose={() => setError(null)} />
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
