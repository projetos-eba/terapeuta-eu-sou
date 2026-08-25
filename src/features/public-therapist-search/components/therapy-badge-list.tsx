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
      {visibleTherapies.map((therapy) => (
        <li key={therapy.id}>
          <span className="inline-flex min-h-7 max-w-[220px] items-center rounded-full bg-brand-lavenderSoft px-3 text-sm font-bold text-brand-primary">
            <span className="truncate" title={therapy.label}>
              {therapy.label}
            </span>
          </span>
        </li>
      ))}

      {hiddenTherapies.length ? (
        <li
          className="relative"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            aria-controls={tooltipId}
            aria-expanded={tooltipOpen}
            aria-label={`Ver mais ${hiddenTherapies.length} terapias de ${therapistName}`}
            aria-describedby={tooltipOpen ? tooltipId : undefined}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
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
            +{hiddenTherapies.length}
          </button>
          <div
            className={`absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-brand-lavender bg-white p-3 text-left text-sm font-semibold leading-5 text-tesText-secondary shadow-card ${tooltipOpen ? "block" : "hidden"}`}
            id={tooltipId}
            role="tooltip"
          >
            <p className="font-extrabold text-brand-deep">Outras terapias</p>
            <ul className="mt-1 space-y-1">
              {hiddenTherapies.map((therapy) => (
                <li key={therapy.id}>{therapy.label}</li>
              ))}
            </ul>
          </div>
        </li>
      ) : null}
    </ul>
  );
}
