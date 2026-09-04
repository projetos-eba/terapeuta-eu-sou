"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function FinancialInfoTooltip({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <span className="group relative inline-flex" ref={containerRef}>
      <button
        aria-controls={tooltipId}
        aria-expanded={open}
        aria-label={`Saiba mais sobre ${label}`}
        className="grid size-7 place-items-center rounded-full text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Info aria-hidden="true" size={15} />
      </button>
      <span
        className={cn(
          "invisible absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-brand-lavender bg-white p-3 text-left text-sm font-semibold leading-5 text-tesText-secondary opacity-0 shadow-card transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
          open && "visible opacity-100",
        )}
        id={tooltipId}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
