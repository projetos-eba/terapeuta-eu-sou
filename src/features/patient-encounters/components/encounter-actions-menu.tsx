"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { EllipsisVertical } from "lucide-react";

import { encounterMoreActions } from "@/features/bookings/booking-actions";
import { routes } from "@/lib/routes";

export function EncounterActionsMenu({
  bookingId,
  className,
}: {
  bookingId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuId = `encounter-actions-${bookingId}`;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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
    <div
      className={className ?? "relative md:justify-self-end"}
      ref={wrapperRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir ações do encontro"
        className="grid size-9 place-items-center rounded-md border border-brand-lavender bg-white text-brand-primary shadow-card transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <EllipsisVertical aria-hidden="true" size={20} />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-dropdown mt-2 w-56 rounded-card border border-brand-lavender bg-white p-2 shadow-float"
          id={menuId}
          role="menu"
        >
          {encounterMoreActions.map((action) => (
            <Link
              className="block rounded-md px-3 py-2 text-sm font-bold text-tesText-secondary transition hover:bg-brand-lavenderSoft hover:text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={action.href(bookingId) as Route<string>}
              key={action.label}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              {action.label}
            </Link>
          ))}
          <Link
            className="block rounded-md px-3 py-2 text-sm font-bold text-status-danger transition hover:bg-status-dangerBg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-danger"
            href={routes.patient.encounterDetail(bookingId) as Route<string>}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            Cancelar encontro
          </Link>
        </div>
      ) : null}
    </div>
  );
}
