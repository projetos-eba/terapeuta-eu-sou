"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";

type FavoriteTherapistButtonProps = {
  initialIsFavorite?: boolean;
  therapistName: string;
  therapistProfileId: string;
};

type ApiFailure = {
  ok: false;
  error?: {
    message?: string;
  };
};

export function FavoriteTherapistButton({
  initialIsFavorite = false,
  therapistName,
  therapistProfileId,
}: FavoriteTherapistButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const actionLabel = isFavorite
    ? "Remover dos favoritos"
    : "Adicionar aos favoritos";

  async function toggleFavorite() {
    if (isSubmitting) return;

    const nextFavorite = !isFavorite;
    setIsSubmitting(true);
    setIsFavorite(nextFavorite);
    setFeedback(null);

    const response = await fetch("/api/patient/favorite-therapists", {
      body: JSON.stringify({ therapistProfileId }),
      headers: { "Content-Type": "application/json" },
      method: nextFavorite ? "POST" : "DELETE",
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiFailure
      | { ok: true }
      | null;

    setIsSubmitting(false);

    if (!response.ok || payload?.ok !== true) {
      setIsFavorite(!nextFavorite);
      setFeedback(
        payload?.ok === false && payload.error?.message
          ? payload.error.message
          : "Não foi possível atualizar favoritos agora.",
      );
      return;
    }

    setFeedback(
      nextFavorite
        ? `${therapistName} foi adicionado aos favoritos.`
        : `${therapistName} foi removido dos favoritos.`,
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-label={`${actionLabel} de ${therapistName}`}
        aria-pressed={isFavorite}
        className="grid size-[52px] place-items-center rounded-full border border-border bg-white text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
        disabled={isSubmitting}
        onClick={toggleFavorite}
      >
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        ) : (
          <Heart
            aria-hidden="true"
            className={isFavorite ? "size-5 fill-current" : "size-5"}
          />
        )}
      </button>
      <p className="sr-only" role="status">
        {feedback ?? ""}
      </p>
    </div>
  );
}
