"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle } from "lucide-react";

import { TESDialog } from "@/components/tes/tes-dialog";

import type {
  MessageCenterActorRole,
  MessageCenterThread,
} from "../message-center.types";

export function MessageThreadDialogButton({
  actorRole,
  thread,
}: {
  actorRole: MessageCenterActorRole;
  thread: MessageCenterThread;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-lavender px-3 text-xs font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <MessageCircle aria-hidden="true" size={15} />
        Ver mensagens
      </button>
      {isOpen ? (
        <TESDialog
          description="Aqui ficam as mensagens aprovadas que você e a outra pessoa receberam nesta conversa."
          onClose={() => setIsOpen(false)}
          title={`Mensagens com ${thread.name}`}
        >
          <div className="grid gap-3">
            {thread.messages.length > 0 ? (
              thread.messages.map((message) => (
                <article
                  className={`max-w-[92%] rounded-2xl border p-4 ${
                    message.isFromViewer
                      ? "ml-auto border-brand-lavender bg-brand-lavenderSoft"
                      : "mr-auto border-brand-lavender/70 bg-surface-muted"
                  }`}
                  key={message.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-brand-deep">
                      {message.isFromViewer ? "Você" : thread.name}
                    </p>
                    <time
                      className="text-[11px] font-semibold text-tesText-secondary"
                      dateTime={message.createdAt}
                    >
                      {formatDate(message.createdAt)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-tesText-secondary">
                    {message.body}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-xl bg-surface-muted p-4 text-sm font-semibold text-tesText-secondary">
                Ainda não há mensagens nesta conversa.
              </p>
            )}
            {thread.cta ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white"
                href={thread.cta.href}
                onClick={() => setIsOpen(false)}
              >
                {actorRole === "patient" ? "Abrir encontro" : "Abrir sessão"}
              </Link>
            ) : null}
          </div>
        </TESDialog>
      ) : null}
    </>
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
