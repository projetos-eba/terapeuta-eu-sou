"use client";

import { useState } from "react";

export function CopyMeetingLinkButton({ meetingUrl }: { meetingUrl: string }) {
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(meetingUrl);
      setFeedback({ tone: "success", message: "Link copiado" });
    } catch {
      setFeedback({
        tone: "error",
        message: "Copie o link pelo campo acima.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        aria-label="Copiar link da videochamada"
        className="inline-flex min-h-12 items-center justify-center rounded-lg border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={handleCopy}
        type="button"
      >
        Copiar link
      </button>
      <span
        aria-live="polite"
        className={`min-h-4 text-xs font-bold ${
          feedback?.tone === "error" ? "text-status-danger" : "text-status-success"
        }`}
      >
        {feedback?.message ?? ""}
      </span>
    </div>
  );
}
