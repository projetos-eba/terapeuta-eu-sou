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
  slug,
  sort,
}: {
  slug: string;
  sort: RelatedTherapistSort;
}): Promise<RelatedTherapistsResult> {
  if (!hasSupabaseConfig()) {
    return {
      errorMessage:
        "Supabase publico nao configurado para consultar profissionais.",
      items: [],
    };
  }

  try {
    const config = getSupabasePublicConfig();
    if (!config) return { items: [] };

    const query = new URLSearchParams();
    query.set(
      "select",
      [
        "slug",
        "public_name",
        "photo_url",
        "therapist_headline",
        "service_description",
        "tags",
        "average_rating",
        "review_count",
        "completed_session_count",
        "next_slot_at",
      ].join(","),
    );
    query.set("therapy_slug", `eq.${slug}`);
    query.set("order", getOrder(sort));
    query.set("limit", "6");

    const response = await fetch(
      `${config.url}/rest/v1/public_therapist_search?${query.toString()}`,
      {
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
        next: { revalidate: 300, tags: [`related-therapists:${slug}`] },
      },
    );

    if (!response.ok) {
      throw new Error("Related therapists fetch failed");
    }

    const rows = (await response.json()) as RelatedTherapistRow[];

    return {
      items: rows.map(mapRelatedTherapist),
    };
  } catch {
    return {
      errorMessage: "Nao foi possivel consultar profissionais relacionados.",
      items: [],
    };
  }
}

function getOrder(sort: RelatedTherapistSort) {
  if (sort === "rating") {
    return "average_rating.desc,review_count.desc,next_slot_at.asc.nullslast,slug.asc";
  }

  if (sort === "next_slot") {
    return "next_slot_at.asc.nullslast,average_rating.desc,review_count.desc,slug.asc";
  }

  return "next_slot_at.asc.nullslast,average_rating.desc,review_count.desc,slug.asc";
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
