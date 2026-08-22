"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type TESDialogProps = {
  children: ReactNode;
  className?: string;
  description?: string;
  onClose: () => void;
  title: string;
};

export function TESDialog({
  children,
  className,
  description,
  onClose,
  title,
}: TESDialogProps) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(focusableSelector);
    (firstFocusable ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-overlay flex items-end justify-center bg-[var(--tes-color-overlay)] p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      data-testid="tes-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "max-h-[calc(100dvh-24px)] w-full max-w-[640px] overflow-x-hidden overflow-y-auto rounded-t-[16px] border border-brand-lavender bg-white p-5 shadow-float outline-none sm:max-h-[calc(100dvh-48px)] sm:rounded-[16px] sm:p-7",
          className,
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4 border-b border-brand-lavender pb-5">
          <div className="min-w-0">
            <h2
              className="font-display text-[28px] font-light leading-tight text-brand-deep sm:text-[32px]"
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <p
                className="mt-2 max-w-xl break-words text-sm font-semibold leading-6 text-tesText-secondary [overflow-wrap:anywhere]"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Fechar"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="min-w-0 pt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
