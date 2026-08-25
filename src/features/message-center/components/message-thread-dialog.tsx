"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { TESButton, TESDialog } from "@/components/tes";

import type {
  MessageCenterActorRole,
  MessageCenterThread,
} from "../message-center.types";

export function MessageThreadDialogButton({
  actorRole,
  thread,
  trigger = "action",
}: {
  actorRole: MessageCenterActorRole;
  thread: MessageCenterThread;
  trigger?: "action" | "title";
}) {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (!isOpen || !thread.conversationId) return;
    void fetch("/api/messages/mark-read", {
      body: JSON.stringify({
        actorRole,
        conversationId: thread.conversationId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
  }, [actorRole, isOpen, thread.conversationId]);
  const isTitleTrigger = trigger === "title";

  return (
    <>
      <TESButton
        aria-label={isTitleTrigger ? `Abrir ${thread.title}` : undefined}
        className={
          isTitleTrigger
            ? "h-auto min-h-0 max-w-full justify-start rounded-md px-0 py-0 text-left text-sm font-extrabold text-brand-deep hover:bg-transparent hover:text-brand-primary hover:underline"
            : "w-fit"
        }
        onClick={() => setIsOpen(true)}
        size="sm"
        title={isTitleTrigger ? thread.title : undefined}
        type="button"
        variant={isTitleTrigger ? "ghost" : "secondary"}
      >
        {isTitleTrigger ? null : <MessageCircle aria-hidden="true" size={15} />}
        {isTitleTrigger ? thread.title : "Ver mensagens"}
      </TESButton>
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
              <TESButton
                href={thread.cta.href}
                onClick={() => setIsOpen(false)}
                size="md"
                variant="primary"
              >
                {actorRole === "patient" ? "Abrir encontro" : "Abrir sessão"}
              </TESButton>
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
