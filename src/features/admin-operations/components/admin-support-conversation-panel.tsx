"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileLock2,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
} from "lucide-react";

import { TESFeedbackDialog } from "@/components/tes";
import {
  notifySupportTicketRefresh,
  useSupportTicketRefreshEvent,
} from "@/features/support/components/support-live-refresh";

import { AdminSupportReplyPanel } from "./admin-support-reply-panel";

type ThreadMessage = {
  author_role: "admin" | "patient" | "therapist";
  body: string;
  created_at: string;
  id: string;
  visibility: "internal" | "requester";
  attachments?: Array<{
    downloadPath: string;
    fileName: string;
    id: string;
    mimeType: string;
    sizeBytes: number;
  }>;
};

export function AdminSupportConversationPanel({
  ticketId,
}: {
  ticketId: string;
}) {
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(
      `/api/admin/support/tickets/${ticketId}/thread`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      messages?: ThreadMessage[];
      ok?: boolean;
    } | null;
    if (!response.ok || !payload?.ok || !payload.messages) {
      setError(
        payload?.error?.message ??
          "Não foi possível carregar a conversa agora.",
      );
      return;
    }
    setMessages(payload.messages);
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load, refreshVersion]);
  useSupportTicketRefreshEvent(ticketId, load);

  function refresh() {
    setRefreshVersion((version) => version + 1);
    notifySupportTicketRefresh(ticketId);
  }

  return (
    <section className="rounded-[28px] border border-brand-lavender/70 bg-white shadow-[0_22px_60px_rgba(20,16,90,0.09)]">
      <header className="border-b border-brand-lavender/70 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <MessageCircle aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-brand-deep">
              Conversa do chamado
            </h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Respostas públicas e registros internos da equipe, em ordem
              cronológica.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-3 px-5 py-5 sm:px-6">
        {messages === null && !error ? (
          <p className="rounded-xl bg-surface-soft px-4 py-4 text-sm font-semibold text-tesText-secondary">
            Carregando conversa…
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-status-dangerBg px-4 py-4 text-sm font-bold text-status-danger">
            {error}
          </p>
        ) : null}
        {messages?.length === 0 ? (
          <p className="rounded-xl bg-surface-soft px-4 py-4 text-sm font-semibold text-tesText-secondary">
            Este chamado ainda não possui mensagens na thread. O contexto de
            abertura permanece no resumo.
          </p>
        ) : null}
        {messages?.map((message) => (
          <article
            className={
              message.visibility === "internal"
                ? "rounded-2xl border border-status-warning/30 bg-status-warningBg p-4"
                : message.author_role === "admin"
                  ? "mr-auto max-w-[92%] rounded-2xl bg-surface-muted p-4"
                  : "ml-auto max-w-[92%] rounded-2xl bg-brand-lavenderSoft p-4"
            }
            key={message.id}
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-extrabold text-brand-deep">
              {message.visibility === "internal" ? (
                <>
                  <FileLock2 aria-hidden="true" size={15} />
                  Nota interna
                </>
              ) : message.author_role === "admin" ? (
                "Equipe TES"
              ) : (
                "Solicitante"
              )}
              <span className="text-xs font-semibold text-tesText-secondary">
                {formatDate(message.created_at)}
              </span>
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-tesText-secondary">
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

      <div className="grid gap-6 border-t border-brand-lavender/70 px-5 py-5 sm:px-6 xl:grid-cols-2">
        <div>
          <h3 className="text-base font-extrabold text-brand-deep">
            Responder ao solicitante
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            A resposta é visível ao solicitante e atualiza o chamado para
            aguardar retorno.
          </p>
          <div className="mt-4">
            <AdminSupportReplyPanel onSuccess={refresh} ticketId={ticketId} />
          </div>
        </div>
        <AdminSupportInternalNote onSuccess={refresh} ticketId={ticketId} />
      </div>
    </section>
  );
}

function AdminSupportInternalNote({
  onSuccess,
  ticketId,
}: {
  onSuccess: () => void;
  ticketId: string;
}) {
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
      `/api/admin/support/tickets/${ticketId}/notes`,
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
        payload?.error?.message ??
          "Não foi possível salvar a nota interna agora.",
      );
      return;
    }
    setBody("");
    requestId.current = null;
    setSuccess(true);
    onSuccess();
  }

  return (
    <div className="rounded-2xl border border-status-warning/30 bg-status-warningBg/55 p-4">
      <div className="flex items-start gap-2">
        <FileLock2
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-status-warning"
          size={17}
        />
        <div>
          <h3 className="text-base font-extrabold text-brand-deep">
            Nota interna
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Visível somente para a equipe TES. Nunca é enviada ao solicitante.
          </p>
        </div>
      </div>
      <label className="mt-4 grid gap-2">
        <span className="sr-only">Nota interna</span>
        <textarea
          className="min-h-28 w-full resize-y rounded-xl border border-brand-lavender bg-white px-3 py-3 text-sm font-semibold leading-6 text-brand-deep"
          disabled={isSubmitting}
          maxLength={4000}
          onChange={(event) => {
            setBody(event.target.value);
            requestId.current = null;
          }}
          placeholder="Registre um contexto interno para a equipe."
          value={body}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-tesText-secondary">
          {body.length}/4000
        </span>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-primary bg-white px-4 text-sm font-extrabold text-brand-primary disabled:opacity-60"
          disabled={!body.trim() || isSubmitting}
          onClick={() => void submit()}
          type="button"
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={16} />
          ) : (
            <FileLock2 aria-hidden="true" size={16} />
          )}
          Salvar nota interna
        </button>
      </div>
      {success ? (
        <p className="mt-3 text-sm font-bold text-status-success">
          Nota interna salva.
        </p>
      ) : null}
      {error ? (
        <TESFeedbackDialog message={error} onClose={() => setError(null)} />
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
