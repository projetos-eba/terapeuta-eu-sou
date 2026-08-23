"use client";

import Link from "next/link";
import type { Route } from "next";
import { Bell, CheckCheck, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 3_000;
const TOAST_DURATION_MS = 8_000;

type ShellNotification = {
  body: string | null;
  createdAt: string;
  href: string | null;
  id: string;
  kind: string;
  readAt: string | null;
  title: string;
};

type NotificationResponse = {
  count: number;
  items: ShellNotification[];
  toast?: ShellNotification | null;
};

export function ShellNotificationButton({
  count: initialCount = 0,
  href,
  role,
}: {
  count?: number;
  href: string;
  role: "admin" | "patient" | "therapist";
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const [count, setCount] = useState(initialCount);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<ShellNotification[]>([]);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [toast, setToast] = useState<ShellNotification | null>(null);

  const showBookingToast = useCallback((item: ShellNotification) => {
    if (typeof window === "undefined") return;

    const storageKey = `tes-shell-booking-toast:${item.id}`;
    if (window.sessionStorage.getItem(storageKey)) return;

    window.sessionStorage.setItem(storageKey, "shown");
    setToast(item);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/notifications?role=${role}`, {
        cache: "no-store",
      });
      if (!response.ok) return;

      const payload = (await response.json()) as NotificationResponse;
      if (!Array.isArray(payload.items) || typeof payload.count !== "number") {
        return;
      }

      const knownIds = knownIdsRef.current;
      const bookingCandidate =
        payload.toast ??
        payload.items.find(
          (item) => item.kind === "booking_confirmed" && item.readAt === null,
        );
      const incomingBooking =
        bookingCandidate && (!knownIds || !knownIds.has(bookingCandidate.id))
          ? bookingCandidate
          : null;

      if (incomingBooking) showBookingToast(incomingBooking);

      knownIdsRef.current = new Set(payload.items.map((item) => item.id));
      setCount(payload.count);
      setItems(payload.items);
    } catch {
      // Keep the server-rendered count when a temporary poll fails.
    }
  }, [role, showBookingToast]);

  useEffect(() => {
    void refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(
      () => setToast(null),
      TOAST_DURATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (
        isOpen &&
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const markRead = useCallback(async (ids: string[]) => {
    const response = await fetch("/api/notifications/mark-read", {
      body: JSON.stringify({ ids, role }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return response.ok;
  }, [role]);

  const handleNotificationClick = useCallback(
    (item: ShellNotification) => {
      setIsOpen(false);
      if (item.readAt !== null) return;

      void markRead([item.id]).then((ok) => {
        if (!ok) return;
        setCount((current) => Math.max(0, current - 1));
        setItems((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, readAt: new Date().toISOString() }
              : notification,
          ),
        );
      });
    },
    [markRead],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (count === 0 || isMarkingAll) return;
    setIsMarkingAll(true);

    try {
      const response = await fetch("/api/notifications/mark-read", {
        body: JSON.stringify({ markAll: true, role }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) return;

      setCount(0);
      setItems((current) =>
        current.map((item) => ({ ...item, readAt: new Date().toISOString() })),
      );
    } finally {
      setIsMarkingAll(false);
    }
  }, [count, isMarkingAll, role]);

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          aria-controls={panelId}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={
            count > 0
              ? `Notificações, ${count} não ${count === 1 ? "lida" : "lidas"}`
              : "Notificações"
          }
          className="relative inline-flex size-11 items-center justify-center rounded-full text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <Bell aria-hidden="true" className="size-6" strokeWidth={1.8} />
          {count > 0 ? (
            <span className="absolute right-0 top-0 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-xs font-semibold leading-5 text-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </button>

        {isOpen ? (
          <section
            aria-label="Notificações recentes"
            className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-brand-lavender bg-white shadow-[0_18px_45px_-20px_rgba(20,16,90,0.35)]"
            id={panelId}
          >
            <div className="flex items-center justify-between gap-3 border-b border-brand-lavender px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-brand-deep">
                  Notificações
                </h2>
                <p className="text-xs text-tesText-secondary">
                  {count === 0
                    ? "Você está em dia."
                    : `${count} ${count === 1 ? "não lida" : "não lidas"}`}
                </p>
              </div>
              {count > 0 ? (
                <button
                  className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-wait disabled:opacity-60"
                  disabled={isMarkingAll}
                  onClick={() => void handleMarkAllRead()}
                  type="button"
                >
                  <CheckCheck aria-hidden="true" className="size-4" />
                  Marcar lidas
                </button>
              ) : null}
            </div>

            {items.length > 0 ? (
              <ul
                aria-label="Lista de notificações"
                className="max-h-[22rem] overflow-y-auto"
              >
                {items.map((item) => (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        className={notificationRowClassName(item)}
                        href={item.href as Route<string>}
                        onClick={() => handleNotificationClick(item)}
                      >
                        <NotificationContent item={item} />
                      </Link>
                    ) : (
                      <button
                        className={notificationRowClassName(item)}
                        onClick={() => handleNotificationClick(item)}
                        type="button"
                      >
                        <NotificationContent item={item} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-tesText-secondary">
                Nenhuma notificação por enquanto.
              </p>
            )}

            <Link
              className="block border-t border-brand-lavender px-4 py-3 text-center text-sm font-semibold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
              href={href as Route<string>}
              onClick={() => setIsOpen(false)}
            >
              {href.startsWith("/admin")
                ? "Abrir suporte"
                : "Abrir Central de mensagens"}
            </Link>
          </section>
        ) : null}
      </div>

      {toast ? (
        <aside
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-brand-lavender bg-white p-4 shadow-[0_18px_45px_-20px_rgba(20,16,90,0.35)] motion-safe:animate-[tes-notification-enter_240ms_ease-out] motion-reduce:animate-none"
          role="status"
        >
          <div className="flex items-start gap-3">
            <Bell
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-brand-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-brand-deep">{toast.title}</p>
              <p className="mt-1 text-sm text-tesText-secondary">
                {toast.body}
              </p>
              {toast.href ? (
                <Link
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-primary outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
                  href={toast.href as Route<string>}
                  onClick={() => {
                    handleNotificationClick(toast);
                    setToast(null);
                  }}
                >
                  Ver detalhes
                </Link>
              ) : null}
            </div>
            <button
              aria-label="Fechar aviso de agendamento"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
              onClick={() => setToast(null)}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
}

function notificationRowClassName(item: ShellNotification) {
  return cn(
    "block w-full border-b border-brand-lavender px-4 py-3 text-left outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/20",
    item.readAt === null ? "bg-brand-lavenderSoft/40" : "bg-white",
  );
}

function NotificationContent({ item }: { item: ShellNotification }) {
  return (
    <span className="block">
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-brand-deep">
          {item.title}
        </span>
        {item.readAt === null ? (
          <span
            aria-label="Não lida"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-primary"
          />
        ) : null}
      </span>
      {item.body ? (
        <span className="mt-1 block text-xs leading-5 text-tesText-secondary">
          {item.body}
        </span>
      ) : null}
    </span>
  );
}
