"use client";

import { useId, useState } from "react";

import type { TherapistSearchTherapy } from "../types";

const visibleTherapyLimit = 2;

export function TherapyBadgeList({
  therapistName,
  therapies,
}: {
  therapistName: string;
  therapies: TherapistSearchTherapy[];
}) {
  const [clickedOpen, setClickedOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tooltipId = useId();
  const visibleTherapies = therapies.slice(0, visibleTherapyLimit);
  const hiddenTherapies = therapies.slice(visibleTherapyLimit);

  if (!therapies.length) return null;

  const tooltipOpen = clickedOpen || focused || hovered;

  return (
    <ul
      aria-label={`Terapias oferecidas por ${therapistName}`}
      className="mt-2 flex flex-wrap gap-2"
    >
      {visibleTherapies.map((therapy, index) => {
        const isLastVisible = index === visibleTherapies.length - 1;

        return (
          <li
            key={therapy.id}
            className={
              hiddenTherapies.length && isLastVisible ? "relative pr-5" : ""
            }
          >
          <span className="inline-flex min-h-7 max-w-[220px] items-center rounded-full bg-brand-lavenderSoft px-3 text-sm font-bold text-brand-primary">
            <span className="truncate" title={therapy.label}>
              {therapy.label}
            </span>
          </span>
          {hiddenTherapies.length && isLastVisible ? (
            <div
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <button
                aria-controls={tooltipId}
                aria-expanded={tooltipOpen}
                aria-label={`Ver mais ${hiddenTherapies.length} terapias de ${therapistName}`}
                aria-describedby={tooltipOpen ? tooltipId : undefined}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-transparent p-0 text-sm font-bold text-brand-primary transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
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
                <span className="inline-flex size-6 items-center justify-center rounded-full border border-brand-lavender bg-white text-xs shadow-sm transition hover:bg-brand-lavenderSoft">
                  +{hiddenTherapies.length}
                </span>
              </button>
              <div
                className={`absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-brand-lavender bg-white p-3 text-left text-sm font-semibold leading-5 text-tesText-secondary shadow-card ${tooltipOpen ? "block" : "hidden"}`}
                id={tooltipId}
                role="tooltip"
              >
                <p className="font-extrabold text-brand-deep">Outras terapias</p>
                <ul className="mt-1 space-y-1">
                  {hiddenTherapies.map((hiddenTherapy) => (
                    <li key={hiddenTherapy.id}>{hiddenTherapy.label}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          </li>
        );
      })}
    </ul>
  );
}
