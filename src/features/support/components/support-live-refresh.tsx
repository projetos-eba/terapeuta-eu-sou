"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useSupportLiveRefresh({
  actorRole,
  onRefresh,
  ticketId,
}: {
  actorRole: "admin" | "patient" | "therapist";
  onRefresh: () => void | Promise<void>;
  ticketId?: string;
}) {
  useEffect(() => {
    const params = new URLSearchParams({ role: actorRole });
    if (ticketId) params.set("ticketId", ticketId);
    let fallback: ReturnType<typeof setInterval> | null = null;
    const refresh = () => void onRefresh();
    const startFallback = () => {
      if (fallback) return;
      fallback = setInterval(refresh, 8_000);
    };
    if (typeof EventSource === "undefined") {
      startFallback();
      return () => {
        if (fallback) clearInterval(fallback);
      };
    }
    const source = new EventSource(`/api/support/events?${params.toString()}`);
    source.onmessage = refresh;
    source.onerror = () => {
      source.close();
      startFallback();
    };
    return () => {
      source.close();
      if (fallback) clearInterval(fallback);
    };
  }, [actorRole, onRefresh, ticketId]);
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

function SupportInboxLiveRefreshClient() {
  const router = useRouter();
  useSupportLiveRefresh({
    actorRole: "admin",
    onRefresh: () => router.refresh(),
  });
  return null;
}

function MessageCenterLiveRefreshClient({
  actorRole,
}: {
  actorRole: "patient" | "therapist";
}) {
  // Kept as a separate client component so the server-rendered page remains
  // the single source of truth after router.refresh().
  const router = useRouter();
  useSupportLiveRefresh({ actorRole, onRefresh: () => router.refresh() });
  return null;
}
