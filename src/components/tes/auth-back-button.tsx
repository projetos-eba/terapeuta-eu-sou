"use client";

import { ArrowLeft } from "lucide-react";

export function AuthBackButton({
  alwaysFallback = false,
  fallbackHref = "/",
}: {
  alwaysFallback?: boolean;
  fallbackHref?: string;
}) {
  function handleBack() {
    if (alwaysFallback) {
      window.location.replace(fallbackHref);
      return;
    }

    const referrer = document.referrer;
    const hasSameOriginHistory =
      window.history.length > 1 &&
      Boolean(referrer) &&
      new URL(referrer).origin === window.location.origin;

    if (hasSameOriginHistory) {
      window.history.back();
      return;
    }

    window.location.replace(fallbackHref);
  }

  return (
    <button
      aria-label="Voltar"
      className="absolute left-4 top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-brand-lavender bg-white p-0 text-brand-primary shadow-card transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:left-8 sm:h-auto sm:min-h-11 sm:w-auto sm:gap-2 sm:px-4"
      onClick={handleBack}
      type="button"
    >
      <ArrowLeft aria-hidden="true" className="size-5 sm:size-4" />
      <span className="hidden sm:inline">Voltar</span>
    </button>
  );
}
