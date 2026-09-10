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

type PublicTherapistPlanRow = {
  plan: "free" | "premium" | "premium_plus";
  slug: string;
};

type PublicTherapistContentRow = {
  guide_items: unknown;
  slug: string;
};

function hasSupabaseConfig() {
  return Boolean(getSupabasePublicConfig());
}

export function parseRelatedTherapistSort(
  value?: string | string[],
): RelatedTherapistSort {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "az" || raw === "rating" || raw === "next_slot") return raw;
  return "az";
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
    const [premiumSlugs, guideThemesBySlug] = await Promise.all([
      getPremiumTherapistSlugs(
        config,
        rows.map((row) => row.slug),
      ),
      getPublishedGuideThemes(config, rows.map((row) => row.slug)),
    ]);

    return {
      items: applyPublicSort(rows, sort).map((row) =>
        mapRelatedTherapist(row, premiumSlugs, guideThemesBySlug),
      ),
    };
  } catch {
    return {
      errorMessage: "Não foi possível consultar profissionais relacionados.",
      items: [],
    };
  }
}

async function getPublishedGuideThemes(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  slugs: string[],
) {
  if (!slugs.length) return new Map<string, string[]>();

  try {
    const response = await fetch(
      `${config.url}/rest/v1/public_therapist_profile_content_v?select=slug,guide_items&slug=in.(${slugs.join(",")})`,
      {
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
        next: { revalidate: 300 },
      },
    );

    if (!response.ok) return new Map<string, string[]>();

    const rows = (await response.json()) as PublicTherapistContentRow[];
    return new Map(
      rows.map((row) => [row.slug, normalizeGuideThemes(row.guide_items)]),
    );
  } catch {
    return new Map<string, string[]>();
  }
}

async function getPremiumTherapistSlugs(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  slugs: string[],
) {
  if (!slugs.length) return new Set<string>();

  try {
    const response = await fetch(
      `${config.url}/rest/v1/public_therapist_profiles_v?select=slug,plan&slug=in.(${slugs.join(",")})`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
    );

    if (!response.ok) return new Set<string>();

    const planRows = (await response.json()) as PublicTherapistPlanRow[];
    return new Set(
      planRows.filter((row) => row.plan !== "free").map((row) => row.slug),
    );
  } catch {
    return new Set<string>();
  }
}

function applyPublicSort(
  rows: RelatedTherapistRow[],
  sort: RelatedTherapistSort,
) {
  if (sort === "az") {
    return [...rows].sort(
      (first, second) =>
        first.public_name.localeCompare(second.public_name, "pt-BR", {
          sensitivity: "base",
        }) || first.slug.localeCompare(second.slug, "pt-BR"),
    );
  }

  if (sort === "rating") {
    return [...rows].sort(
      (first, second) =>
        Number(second.average_rating ?? 0) -
          Number(first.average_rating ?? 0) ||
        Number(second.review_count ?? 0) - Number(first.review_count ?? 0) ||
        compareNullableDate(first.next_slot_at, second.next_slot_at) ||
        first.slug.localeCompare(second.slug, "pt-BR"),
    );
  }

  if (sort === "next_slot") {
    return [...rows].sort(
      (first, second) =>
        compareNullableDate(first.next_slot_at, second.next_slot_at) ||
        Number(second.average_rating ?? 0) -
          Number(first.average_rating ?? 0) ||
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

function mapRelatedTherapist(
  row: RelatedTherapistRow,
  premiumSlugs: Set<string>,
  guideThemesBySlug: Map<string, string[]>,
): RelatedTherapist {
  return {
    averageRating:
      row.review_count && row.review_count > 0
        ? Number(row.average_rating ?? 0)
        : null,
    completedSessionCount: row.completed_session_count ?? 0,
    headline: row.therapist_headline ?? "Terapeuta TES",
    isAcceptingBookings: true,
    isPremium: premiumSlugs.has(row.slug),
    matchingInterestCount: row.matching_interest_count ?? 0,
    matchingServiceThemeCount: row.matching_service_theme_count ?? 0,
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
    guideThemes: guideThemesBySlug.get(row.slug) ?? [],
  };
}

function normalizeGuideThemes(value: unknown) {
  if (!Array.isArray(value)) return [];

  const uniqueThemes = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || !("label" in item)) continue;
    const label = item.label;
    if (typeof label !== "string" || !label.trim()) continue;
    uniqueThemes.add(label.trim());
  }

  return [...uniqueThemes];
}
