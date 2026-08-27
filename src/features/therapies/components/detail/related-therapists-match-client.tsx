"use client";

import { useEffect, useState } from "react";

import { MATCHING_SESSION_KEY } from "@/features/public-matching/components/journey-match-client";
import type {
  PublicTherapyDetail,
  RelatedTherapist,
  RelatedTherapistSort,
} from "../../types/therapy-detail";
import { RelatedTherapists } from "./related-therapists";

type RelatedTherapistsMatchClientProps = {
  errorMessage?: string;
  initialTherapists: RelatedTherapist[];
  source: string;
  sort: RelatedTherapistSort;
  therapy: PublicTherapyDetail;
};

type StoredMatchContext = {
  interestIds?: unknown;
  source?: unknown;
  themeIds?: unknown;
};

type ApiEnvelope =
  | {
      errorMessage?: string;
      items: RelatedTherapist[];
      ok: true;
    }
  | {
      error?: {
        message?: string;
      };
      ok: false;
    };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function RelatedTherapistsMatchClient({
  errorMessage,
  initialTherapists,
  source,
  sort,
  therapy,
}: RelatedTherapistsMatchClientProps) {
  const [therapists, setTherapists] = useState(initialTherapists);
  const [activeMatchContext, setActiveMatchContext] = useState(false);
  const [clientError, setClientError] = useState(errorMessage);

  useEffect(() => {
    if (source !== "match") return;

    const stored = sessionStorage.getItem(MATCHING_SESSION_KEY);
    const context = parseStoredContext(stored);

    if (!context) {
      setActiveMatchContext(false);
      return;
    }

    const matchContext = context;

    async function rankWithContext() {
      try {
        const response = await fetch("/api/public/therapy-therapists", {
          body: JSON.stringify({
            interestIds: matchContext.interestIds,
            slug: therapy.slug,
            sort: "relevance",
            themeIds: matchContext.themeIds,
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const payload = (await response
          .json()
          .catch(() => null)) as ApiEnvelope;

        if (!response.ok || !payload?.ok) {
          return;
        }

        setTherapists(payload.items);
        setClientError(payload.errorMessage);
        setActiveMatchContext(true);
      } catch {
        setActiveMatchContext(false);
      }
    }

    void rankWithContext();
  }, [sort, source, therapy.slug]);

  return (
    <RelatedTherapists
      errorMessage={clientError}
      matchContextActive={activeMatchContext}
      source={source}
      sort={sort}
      therapists={therapists}
      therapy={therapy}
    />
  );
}

function parseStoredContext(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as StoredMatchContext;
    const themeIds = parseUuidArray(parsed.themeIds, 3);
    const interestIds = parseUuidArray(parsed.interestIds, 9);

    if (!themeIds.length) return null;

    return {
      interestIds,
      themeIds,
    };
  } catch {
    return null;
  }
}

function parseUuidArray(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) return [];
  const ids = value.filter((item): item is string => UUID.test(String(item)));
  return ids.length === value.length ? ids : [];
}
