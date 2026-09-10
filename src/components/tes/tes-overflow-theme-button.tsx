"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type TESOverflowThemeButtonProps = {
  className?: string;
  entityLabel: string;
  icon?: ReactNode;
  themes: Array<{ id?: string; label: string }>;
  tooltipClassName?: string;
  visibleCount: number;
};

export function TESOverflowThemeButton({
  className,
  entityLabel,
  icon,
  themes,
  tooltipClassName,
  visibleCount,
}: TESOverflowThemeButtonProps) {
  const [clickedOpen, setClickedOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const hiddenThemes = themes.slice(visibleCount);
  const tooltipOpen = clickedOpen || focused || hovered;

  useEffect(() => {
    if (!clickedOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !containerRef.current?.contains(target)) {
        setClickedOpen(false);
        setFocused(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [clickedOpen]);

  if (hiddenThemes.length === 0) return null;

  return (
    <div
      className="relative"
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        aria-controls={tooltipId}
        aria-describedby={tooltipOpen ? tooltipId : undefined}
        aria-expanded={tooltipOpen}
        aria-label={`Ver mais ${hiddenThemes.length} ${hiddenThemes.length === 1 ? "tema" : "temas"} de ${entityLabel}`}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-brand-lavenderSoft px-3 text-xs font-extrabold text-brand-primary transition hover:bg-brand-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
          className,
        )}
        onBlur={() => setFocused(false)}
        onClick={() => setClickedOpen((current) => !current)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setClickedOpen(false);
            setFocused(false);
            event.currentTarget.blur();
          }
        }}
        type="button"
      >
        {icon}
        +{hiddenThemes.length}
      </button>
      <div
        className={cn(
          "absolute bottom-full right-0 z-30 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-brand-lavender bg-white p-3 text-left text-sm font-semibold leading-5 text-tesText-secondary shadow-card",
          tooltipOpen ? "block" : "hidden",
          tooltipClassName,
        )}
        id={tooltipId}
        role="tooltip"
      >
        <p className="font-extrabold text-brand-deep">Outros temas</p>
        <ul className="mt-1 space-y-1">
          {hiddenThemes.map((theme, index) => (
            <li key={theme.id ?? `${theme.label}-${index}`}>{theme.label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
