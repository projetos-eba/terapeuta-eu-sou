"use client";

import { useEffect } from "react";

import { emitPublicMetricEvents } from "../public-metric-events.client";

export function PublicSearchMetricsTracker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;

    const resultSetId = crypto.randomUUID();
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEvents = entries.flatMap((entry) => {
          if (!entry.isIntersecting) return [];

          const element = entry.target as HTMLElement;
          const therapistSlug = element.dataset.metricTherapistSlug;
          const resultPosition = Number(element.dataset.metricResultPosition);

          if (
            !therapistSlug ||
            !Number.isSafeInteger(resultPosition) ||
            resultPosition < 1
          ) {
            return [];
          }

          observer.unobserve(element);
          return [
            {
              eventType: "search_impression" as const,
              resultPosition,
              resultSetId,
              sourceSurface: "therapist_search" as const,
              therapistSlug,
            },
          ];
        });

        emitPublicMetricEvents(visibleEvents);
      },
      { threshold: 0.5 },
    );

    const cards = document.querySelectorAll<HTMLElement>(
      "[data-metric-therapist-slug][data-metric-result-position]",
    );
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [enabled]);

  return null;
}
