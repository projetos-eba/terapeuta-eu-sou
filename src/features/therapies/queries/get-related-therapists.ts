import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type {
  RelatedTherapist,
  RelatedTherapistRow,
  RelatedTherapistSort,
} from "../types/therapy-detail";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";

export type RelatedTherapistsResult = {
  errorMessage?: string;
  items: RelatedTherapist[];
};

function hasSupabaseConfig() {
  return Boolean(getSupabasePublicConfig());
}

export function parseRelatedTherapistSort(
  value?: string | string[],
): RelatedTherapistSort {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "rating" || raw === "next_slot") return raw;
  return "relevance";
}

export async function getRelatedTherapists({
  interestIds = [],
  limit = 6,
  slug,
  sort,
  themeIds = [],
}: {
  interestIds?: string[];
  limit?: number;
  slug: string;
  sort: RelatedTherapistSort;
  themeIds?: string[];
}): Promise<RelatedTherapistsResult> {
  if (!hasSupabaseConfig()) {
    return {
      errorMessage:
        "Supabase público não configurado para consultar profissionais.",
      items: [],
    };
  }

  try {
    const config = getSupabasePublicConfig();
    if (!config) return { items: [] };

    const response = await fetch(
      `${config.url}/rest/v1/rpc/get_public_therapy_therapists_v1`,
      {
        body: JSON.stringify({
          p_interest_ids: interestIds,
          p_limit: limit,
          p_theme_ids: themeIds,
          p_therapy_slug: slug,
        }),
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        next:
          themeIds.length || interestIds.length
            ? undefined
            : { revalidate: 300, tags: [`related-therapists:${slug}`] },
      },
    );

    if (!response.ok) {
      throw new Error("Related therapists fetch failed");
    }

    const rows = (await response.json()) as RelatedTherapistRow[];

    return {
      items: applyPublicSort(rows, sort).map(mapRelatedTherapist),
    };
  } catch {
    return {
      errorMessage: "Não foi possível consultar profissionais relacionados.",
      items: [],
    };
  }
}

function applyPublicSort(rows: RelatedTherapistRow[], sort: RelatedTherapistSort) {
  if (sort === "rating") {
    return [...rows].sort(
      (first, second) =>
        Number(second.average_rating ?? 0) - Number(first.average_rating ?? 0) ||
        Number(second.review_count ?? 0) - Number(first.review_count ?? 0) ||
        compareNullableDate(first.next_slot_at, second.next_slot_at) ||
        first.slug.localeCompare(second.slug, "pt-BR"),
    );
  }

  if (sort === "next_slot") {
    return [...rows].sort(
      (first, second) =>
        compareNullableDate(first.next_slot_at, second.next_slot_at) ||
        Number(second.average_rating ?? 0) - Number(first.average_rating ?? 0) ||
        Number(second.review_count ?? 0) - Number(first.review_count ?? 0) ||
        first.slug.localeCompare(second.slug, "pt-BR"),
    );
  }

  return rows;
}

function compareNullableDate(first: string | null, second: string | null) {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return new Date(first).getTime() - new Date(second).getTime();
}

function mapRelatedTherapist(row: RelatedTherapistRow): RelatedTherapist {
  return {
    averageRating:
      row.review_count && row.review_count > 0
        ? Number(row.average_rating ?? 0)
        : null,
    completedSessionCount: row.completed_session_count ?? 0,
    headline: row.therapist_headline ?? "Terapeuta TES",
    isAcceptingBookings: true,
    name: row.public_name,
    nextSlotAt: row.next_slot_at,
    photoUrl: getTherapistAvatarUrl(row.photo_url, {
      name: row.public_name,
      slug: row.slug,
    }),
    reviewCount: row.review_count ?? 0,
    serviceDescription:
      row.service_description ??
      "Atendimento online publicado pela plataforma.",
    slug: row.slug,
    tags: (row.tags ?? []).slice(0, 3),
  };
}
