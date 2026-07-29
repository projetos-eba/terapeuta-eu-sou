"use client";

import { useEffect } from "react";

import { emitPublicMetricEvents } from "../public-metric-events.client";

export function PublicProfileMetricsTracker({
  enabled,
  therapistSlug,
}: {
  enabled: boolean;
  therapistSlug: string;
}) {
  useEffect(() => {
    if (!enabled) return;

    emitPublicMetricEvents([
      {
        eventType: "profile_view",
        sourceSurface: "therapist_profile",
        therapistSlug,
      },
    ]);
  }, [enabled, therapistSlug]);

  return null;
}
