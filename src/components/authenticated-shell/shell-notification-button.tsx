"use client";

import { Bell } from "lucide-react";

export function ShellNotificationButton({ count = 0 }: { count?: number }) {
  return (
    <button
      aria-label={
        count > 0
          ? `Notificações, ${count} não ${count === 1 ? "lida" : "lidas"}`
          : "Notificações"
      }
      className="relative inline-flex size-11 items-center justify-center rounded-full text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
      type="button"
    >
      <Bell aria-hidden="true" className="size-6" strokeWidth={1.8} />
      {count > 0 ? (
        <span className="absolute right-0 top-0 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-xs font-semibold leading-5 text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
