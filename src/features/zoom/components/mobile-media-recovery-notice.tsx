"use client";

import { AlertCircle, Headphones, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./mobile-media-recovery-notice.module.css";

const NOTICE_DURATION_MS = 10_000;

export function MobileMediaRecoveryNotice({
  onOpenSupport,
}: {
  onOpenSupport?: () => void;
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setIsVisible(false),
      NOTICE_DURATION_MS,
    );

    return () => window.clearTimeout(timer);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      aria-live="polite"
      className={`${styles.notice} gap-3 rounded-[20px] border border-brand-lavender bg-surface-soft p-4 text-brand-deep shadow-card`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <AlertCircle aria-hidden="true" size={19} />
        </span>
        <div className="grid gap-1">
          <p className="text-sm font-extrabold">Câmera ou áudio com problema?</p>
          <p className="text-sm font-semibold leading-5 text-tesText-secondary">
            Tente atualizar esta página. Se continuar, fale com o suporte.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-primary px-4 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          onClick={() => window.location.reload()}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Atualizar página
        </button>
        {onOpenSupport ? (
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onClick={onOpenSupport}
            type="button"
          >
            <Headphones aria-hidden="true" size={17} />
            Falar com o suporte
          </button>
        ) : null}
      </div>
    </aside>
  );
}
