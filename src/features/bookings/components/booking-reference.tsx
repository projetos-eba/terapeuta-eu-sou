"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

export function BookingReference({
  id,
  reference,
  className,
  revealOnInteraction = false,
}: {
  id: string;
  reference?: string;
  className?: string;
  revealOnInteraction?: boolean;
}) {
  const [clickedOpen, setClickedOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tooltipId = useId();

  if (!id) return null;

  const label = reference ? `Sessão #${reference}` : `ID: ${id}`;
  const tooltipOpen = clickedOpen || focused || hovered;

  if (revealOnInteraction) {
    return (
      <div
        className={cn("relative mt-1 min-w-0 max-w-full", className)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          aria-controls={tooltipId}
          aria-describedby={tooltipOpen ? tooltipId : undefined}
          aria-expanded={tooltipOpen}
          aria-label={
            reference
              ? label
              : `${label}. Pressione para ver o identificador completo.`
          }
          className="block w-full truncate whitespace-nowrap text-left text-[11px] font-semibold leading-4 text-tesText-muted underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:text-xs"
          data-testid="booking-reference"
          onBlur={() => setFocused(false)}
          onClick={() => {
            if (!reference) setClickedOpen((current) => !current);
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setClickedOpen(false);
              setFocused(false);
              event.currentTarget.blur();
            }
          }}
          title={reference ? undefined : label}
          type="button"
        >
          {reference ? (
            <>
              Sessão #{" "}
              <span className="font-mono tracking-[-0.01em]">{reference}</span>
            </>
          ) : (
            <>
              ID: <span className="font-mono tracking-[-0.01em]">{id}</span>
            </>
          )}
        </button>
        {!reference ? (
          <span
            className={`absolute left-0 top-full z-20 mt-2 w-max max-w-full break-all rounded-xl border border-brand-lavender bg-white p-3 text-xs font-semibold leading-5 text-tesText-secondary shadow-card ${tooltipOpen ? "block" : "hidden"}`}
            id={tooltipId}
            role="tooltip"
          >
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <p
      className={cn(
        "mt-1 block w-full max-w-full truncate whitespace-nowrap text-[11px] font-semibold leading-4 text-tesText-muted sm:text-xs",
        className,
      )}
      data-testid="booking-reference"
      title={reference ? undefined : label}
    >
      {reference ? (
        <>
          Sessão #{" "}
          <span className="font-mono tracking-[-0.01em]">{reference}</span>
        </>
      ) : (
        <>
          ID: <span className="font-mono tracking-[-0.01em]">{id}</span>
        </>
      )}
    </p>
  );
}
