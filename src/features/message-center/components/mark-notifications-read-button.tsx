"use client";

import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { useState } from "react";

type ApiFailure = {
  ok: false;
  error?: {
    message?: string;
  };
};

export function MarkNotificationsReadButton({
  unreadCount,
}: {
  unreadCount: number;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function markRead() {
    if (isSubmitting || unreadCount === 0) return;

    setIsSubmitting(true);
    setFeedback(null);

    const response = await fetch("/api/notifications/mark-read", {
      body: JSON.stringify({ markAll: true }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiFailure
      | { ok: true }
      | null;

    setIsSubmitting(false);

    if (!response.ok || payload?.ok !== true) {
      setFeedback(
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : "Não foi possível atualizar notificações agora.",
      );
      return;
    }

    setFeedback("Notificações marcadas como lidas.");
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-xs font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={unreadCount === 0 || isSubmitting}
        onClick={markRead}
        type="button"
      >
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <CheckCheck aria-hidden="true" size={16} />
        )}
        Marcar avisos como lidos
      </button>
      <p className="sr-only" role="status">
        {feedback ?? ""}
      </p>
    </div>
  );
}
