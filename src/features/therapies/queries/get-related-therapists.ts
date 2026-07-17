import type {
  RelatedTherapist,
  RelatedTherapistRow,
  RelatedTherapistSort,
} from "../types/therapy-detail";

const PLACEHOLDER_SUPABASE_URL = "https://your-project-ref.supabase.co";
const PLACEHOLDER_SUPABASE_ANON_KEY = "replace-with-supabase-anon-key";

export type RelatedTherapistsResult = {
  errorMessage?: string;
  items: RelatedTherapist[];
};

function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(
    url &&
      anonKey &&
      url !== PLACEHOLDER_SUPABASE_URL &&
      anonKey !== PLACEHOLDER_SUPABASE_ANON_KEY,
  );
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
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return { items: [] };

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
    query.set("limit", "3");

    const response = await fetch(
      `${url}/rest/v1/public_therapist_search?${query.toString()}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        next: { revalidate: 300, tags: ["related-therapists"] },
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
    photoUrl: row.photo_url,
    reviewCount: row.review_count ?? 0,
    serviceDescription:
      row.service_description ??
      "Atendimento online publicado pela plataforma.",
    slug: row.slug,
    tags: (row.tags ?? []).slice(0, 3),
  };
}
