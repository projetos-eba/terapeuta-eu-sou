"use client";

import type { PublicMetricEvent } from "./public-metric-events.contract";

const sessionStorageKey = "tes_public_metric_session_id";
let volatileSessionId: string | null = null;

type PublicMetricEventDraft<T> = T extends { eventId: string }
  ? Omit<T, "eventId"> & { eventId?: string }
  : never;

export function emitPublicMetricEvents(
  events: Array<PublicMetricEventDraft<PublicMetricEvent>>,
) {
  if (events.length === 0 || typeof window === "undefined") return;

  const sessionId = getMetricSessionId();
  const payload = {
    events: events.map((event) => ({
      ...event,
      eventId: event.eventId ?? crypto.randomUUID(),
    })),
    sessionId,
  };

  void fetch("/api/public/metrics/events", {
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Product telemetry never blocks the visitor's primary task.
  });
}

function getMetricSessionId() {
  if (volatileSessionId) return volatileSessionId;

  try {
    const stored = window.sessionStorage.getItem(sessionStorageKey);
    if (stored) {
      volatileSessionId = stored;
      return stored;
    }

    const created = crypto.randomUUID();
    window.sessionStorage.setItem(sessionStorageKey, created);
    volatileSessionId = created;
    return created;
  } catch {
    volatileSessionId = crypto.randomUUID();
    return volatileSessionId;
  }
}
