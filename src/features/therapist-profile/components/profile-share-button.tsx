"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

type ProfileShareButtonProps = {
  profilePath: string;
};

export function getCanonicalProfileShareUrl(
  profilePath: string,
  origin: string,
) {
  return new URL(profilePath, origin).toString();
}

export function ProfileShareButton({ profilePath }: ProfileShareButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  async function shareProfile() {
    if (isSharing) return;

    setIsSharing(true);
    setFeedback(null);
    const url = getCanonicalProfileShareUrl(
      profilePath,
      window.location.origin,
    );

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url });
        setFeedback("Link do perfil compartilhado.");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback("Link do perfil copiado.");
        return;
      }

      setFeedback("Não foi possível compartilhar o link agora.");
    } catch {
      setFeedback("Não foi possível compartilhar o link agora.");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        aria-label="Compartilhar perfil"
        className="grid size-[52px] place-items-center rounded-full border border-border bg-white text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
        disabled={isSharing}
        onClick={shareProfile}
        type="button"
      >
        <Share2 aria-hidden="true" className="size-5" />
      </button>
      <p className="sr-only" role="status">
        {feedback ?? ""}
      </p>
    </div>
  );
}
