"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const supportTicketRefreshEvent = "tes:support-ticket-refresh";
const fallbackIntervalMs = 8_000;
const maximumReconnectDelayMs = 30_000;

export function notifySupportTicketRefresh(ticketId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ ticketId: string }>(supportTicketRefreshEvent, {
      detail: { ticketId },
    }),
  );
}

export function useSupportTicketRefreshEvent(
  ticketId: string,
  onRefresh: () => void | Promise<void>,
) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ ticketId?: string }>).detail;
      if (detail?.ticketId === ticketId) void refreshRef.current();
    };
    window.addEventListener(supportTicketRefreshEvent, listener);
    return () => window.removeEventListener(supportTicketRefreshEvent, listener);
  }, [ticketId]);
}

export function useSupportLiveRefresh({
  actorRole,
  onRefresh,
  ticketId,
}: {
  actorRole: "admin" | "patient" | "therapist";
  onRefresh: () => void | Promise<void>;
  ticketId?: string;
}) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    const params = new URLSearchParams({ role: actorRole });
    if (ticketId) params.set("ticketId", ticketId);

    let disposed = false;
    let source: EventSource | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let refreshInFlight = false;

    const refresh = async () => {
      if (refreshInFlight || disposed) return;
      refreshInFlight = true;
      try {
        await refreshRef.current();
      } finally {
        refreshInFlight = false;
      }
    };
    const stopFallback = () => {
      if (!fallback) return;
      clearInterval(fallback);
      fallback = null;
    };
    const startFallback = () => {
      if (fallback) return;
      fallback = setInterval(() => void refresh(), fallbackIntervalMs);
    };
    const clearReconnect = () => {
      if (!reconnect) return;
      clearTimeout(reconnect);
      reconnect = null;
    };
    const disconnect = () => {
      if (!source) return;
      source.close();
      source = null;
    };
    const scheduleReconnect = () => {
      if (disposed || reconnect || typeof EventSource === "undefined") return;
      const delay = Math.min(
        1_000 * 2 ** reconnectAttempt + Math.floor(Math.random() * 300),
        maximumReconnectDelayMs,
      );
      reconnectAttempt += 1;
      reconnect = setTimeout(() => {
        reconnect = null;
        connect();
      }, delay);
    };
    const connect = () => {
      disconnect();
      if (disposed) return;
      if (typeof EventSource === "undefined") {
        startFallback();
        return;
      }
      source = new EventSource(`/api/support/events?${params.toString()}`);
      source.onopen = () => {
        reconnectAttempt = 0;
        stopFallback();
      };
      source.onmessage = () => void refresh();
      source.onerror = () => {
        disconnect();
        startFallback();
        scheduleReconnect();
      };
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
      if (!source) {
        clearReconnect();
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      disconnect();
      stopFallback();
      clearReconnect();
    };
  }, [actorRole, ticketId]);
}

export function MessageCenterLiveRefresh({
  actorRole,
  enabled = true,
}: {
  actorRole: "patient" | "therapist";
  enabled?: boolean;
}) {
  return enabled ? (
    <MessageCenterLiveRefreshClient actorRole={actorRole} />
  ) : null;
}

export function SupportInboxLiveRefresh() {
  return typeof window === "undefined" ? null : (
    <SupportInboxLiveRefreshClient />
  );
}

export function AdminSupportDetailLiveRefresh({ ticketId }: { ticketId: string }) {
  return <AdminSupportDetailLiveRefreshClient ticketId={ticketId} />;
}

function SupportInboxLiveRefreshClient() {
  const router = useRouter();
  useSupportLiveRefresh({
    actorRole: "admin",
    onRefresh: () => router.refresh(),
  });
  return null;
}

function AdminSupportDetailLiveRefreshClient({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  useSupportTicketRefreshEvent(ticketId, () => router.refresh());
  useSupportLiveRefresh({
    actorRole: "admin",
    ticketId,
    onRefresh: () => {
      notifySupportTicketRefresh(ticketId);
    },
  });
  return null;
}

function MessageCenterLiveRefreshClient({
  actorRole,
}: {
  actorRole: "patient" | "therapist";
}) {
  const router = useRouter();
  useSupportLiveRefresh({ actorRole, onRefresh: () => router.refresh() });
  return null;
}
