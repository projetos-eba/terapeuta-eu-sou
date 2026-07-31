import { routes } from "@/lib/routes";
import {
  isPublicDemoDataEnabled,
  publicDataDegraded,
  type PublicDataDegradedReason,
} from "@/lib/public-data-result";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";

import { fallbackTherapists, THERAPIST_SEARCH_PAGE_SIZE } from "./content";
import { getActiveFilterCount } from "./filters";
import {
  formatDurationLabel,
  formatNextSlotLabel,
  formatPriceLabel,
  formatRatingLabel,
  formatReviewsLabel,
  getAvailabilityBucket,
} from "./formatters";
import type {
  TherapistSearchCard,
  TherapistSearchFilters,
  TherapistSearchOption,
  TherapistSearchResult,
} from "./types";

type PublicTherapistSearchRow = {
  average_rating: number | null;
  city: string | null;
  duration_minutes: number | null;
  has_video: boolean | null;
  highlight: string | null;
  highlight_tone: "featured" | "verified" | null;
  next_slot_at: string | null;
  photo_url: string | null;
  public_name: string;
  review_count: number | null;
  review_quote: string | null;
  search_text: string | null;
  service_description: string | null;
  service_id: string;
  service_price_cents: number;
  service_title: string;
  slug: string;
  state: string | null;
  tags: string[] | null;
  theme_names: string[] | null;
  theme_slugs: string[] | null;
  therapist_headline: string | null;
  therapy_id: string;
  therapy_name: string;
  therapy_slug: string;
};

function hasSupabaseConfig() {
  return Boolean(getSupabasePublicConfig());
}

async function fetchTherapistRows() {
  const config = getSupabasePublicConfig();

  if (!config) return [];

  const response = await fetch(
    `${config.url}/rest/v1/public_therapist_search?select=*&order=public_name.asc`,
    {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
      },
      next: { revalidate: 900, tags: ["therapist-search"] },
    },
  );

  if (!response.ok) {
    throw new Error("Public therapist search fetch failed");
  }

  return (await response.json()) as PublicTherapistSearchRow[];
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const themeLabelsBySlug: Record<string, string> = {
  autoconhecimento: "Autoconhecimento",
  "equilibrio-emocional": "Equilíbrio emocional",
  "mudancas-de-vida": "Mudanças de vida",
};

function formatSlugLabel(slug: string) {
  return (
    themeLabelsBySlug[slug] ??
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function mapTherapistRow(row: PublicTherapistSearchRow): TherapistSearchCard {
  const rating = row.average_rating ?? 0;
  const reviewCount = row.review_count ?? 0;
  const tags = row.tags?.length
    ? row.tags
    : (row.theme_names?.slice(0, 3) ?? [row.therapy_name]);

  return {
    availabilityBucket: getAvailabilityBucket(row.next_slot_at),
    cityState: [row.city, row.state].filter(Boolean).join(", "),
    description:
      row.service_description ??
      row.therapist_headline ??
      "Atendimento online com escuta cuidadosa e linguagem responsável.",
    durationLabel: formatDurationLabel(row.duration_minutes ?? 50),
    hasVideo: Boolean(row.has_video),
    highlight: row.highlight ?? "Perfil Verificado",
    highlightTone: row.highlight_tone ?? "verified",
    href: routes.public.therapistProfile(row.slug),
    image:
      getTherapistAvatarUrl(row.photo_url, {
        name: row.public_name,
        slug: row.slug,
      }) || "/therapists/ana-oliveira.png",
    name: row.public_name,
    nextSlotAt: row.next_slot_at,
    nextSlotLabel: formatNextSlotLabel(row.next_slot_at),
    priceCents: row.service_price_cents,
    priceLabel: formatPriceLabel(row.service_price_cents),
    quote: row.review_quote ?? "Perfil verificado na plataforma TES.",
    rating,
    ratingLabel: rating ? formatRatingLabel(rating) : "Novo",
    reviewsLabel: formatReviewsLabel(reviewCount),
    reviewCount,
    serviceId: row.service_id,
    serviceTitle: row.service_title,
    slug: row.slug,
    tags,
    themeSlugs: row.theme_slugs ?? [],
    therapyId: row.therapy_id,
    therapyName: row.therapy_name,
    therapySlug: row.therapy_slug,
  };
}

function getOptions(therapists: TherapistSearchCard[]) {
  const therapies = new Map<string, TherapistSearchOption>();
  const themes = new Map<string, TherapistSearchOption>();

  therapists.forEach((therapist) => {
    therapies.set(therapist.therapySlug, {
      label: therapist.therapyName,
      value: therapist.therapySlug,
    });

    therapist.themeSlugs.forEach((slug) => {
      themes.set(slug, { label: formatSlugLabel(slug), value: slug });
    });
  });

  return {
    themes: Array.from(themes.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    ),
    therapies: Array.from(therapies.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    ),
  };
}

function matchesFilters(
  therapist: TherapistSearchCard,
  filters: TherapistSearchFilters,
) {
  if (filters.q) {
    const haystack = normalizeSearch(
      [
        therapist.name,
        therapist.serviceTitle,
        therapist.description,
        therapist.therapyName,
        therapist.cityState,
        ...therapist.tags,
      ].join(" "),
    );

    if (!haystack.includes(normalizeSearch(filters.q))) return false;
  }

  if (filters.therapy && therapist.therapySlug !== filters.therapy) {
    return false;
  }

  if (filters.theme && !therapist.themeSlugs.includes(filters.theme)) {
    return false;
  }

  if (
    filters.availability &&
    !(
      therapist.availabilityBucket === filters.availability ||
      (filters.availability === "week" &&
        ["today", "tomorrow", "week"].includes(therapist.availabilityBucket))
    )
  ) {
    return false;
  }

  if (filters.price === "up-to-100" && therapist.priceCents > 10000) {
    return false;
  }

  if (
    filters.price === "100-150" &&
    (therapist.priceCents < 10000 || therapist.priceCents > 15000)
  ) {
    return false;
  }

  if (filters.price === "150-plus" && therapist.priceCents <= 15000) {
    return false;
  }

  if (filters.rating === "4-plus" && therapist.rating < 4) {
    return false;
  }

  if (filters.rating === "4-5-plus" && therapist.rating < 4.5) {
    return false;
  }

  return true;
}

function sortTherapists(
  therapists: TherapistSearchCard[],
  filters: TherapistSearchFilters,
) {
  return [...therapists].sort((a, b) => {
    if (filters.sort === "rating") {
      return b.rating - a.rating || b.reviewCount - a.reviewCount;
    }

    if (filters.sort === "price_asc") {
      return a.priceCents - b.priceCents || b.rating - a.rating;
    }

    if (filters.sort === "next_slot") {
      return (
        new Date(a.nextSlotAt ?? "2999-01-01").getTime() -
        new Date(b.nextSlotAt ?? "2999-01-01").getTime()
      );
    }

    return (
      Number(b.highlightTone === "featured") -
        Number(a.highlightTone === "featured") ||
      b.rating - a.rating ||
      b.reviewCount - a.reviewCount
    );
  });
}

function paginate(
  therapists: TherapistSearchCard[],
  filters: TherapistSearchFilters,
  status: TherapistSearchResult["status"],
  source: TherapistSearchResult["source"],
  allTherapists: TherapistSearchCard[],
  degraded?: {
    correlationId: string;
    reason: PublicDataDegradedReason;
  },
): TherapistSearchResult {
  const totalCount = therapists.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / THERAPIST_SEARCH_PAGE_SIZE),
  );
  const currentPage = Math.min(filters.page, totalPages);
  const start = (currentPage - 1) * THERAPIST_SEARCH_PAGE_SIZE;

  return {
    activeFilterCount: getActiveFilterCount(filters),
    currentPage,
    filters: { ...filters, page: currentPage },
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    options: getOptions(allTherapists),
    pageSize: THERAPIST_SEARCH_PAGE_SIZE,
    correlationId: degraded?.correlationId,
    degradedReason: degraded?.reason,
    source,
    status,
    therapists: therapists.slice(start, start + THERAPIST_SEARCH_PAGE_SIZE),
    totalCount,
    totalPages,
  };
}

function buildResult(
  therapists: TherapistSearchCard[],
  filters: TherapistSearchFilters,
  status: TherapistSearchResult["status"],
  source: TherapistSearchResult["source"],
  degraded?: {
    correlationId: string;
    reason: PublicDataDegradedReason;
  },
) {
  const filtered = sortTherapists(
    therapists.filter((therapist) => matchesFilters(therapist, filters)),
    filters,
  );

  const resolvedStatus =
    status === "success" && filtered.length === 0 ? "empty" : status;

  return paginate(
    filtered,
    filters,
    resolvedStatus,
    source,
    therapists,
    degraded,
  );
}

export async function getPublicTherapistSearchResult(
  filters: TherapistSearchFilters,
): Promise<TherapistSearchResult> {
  if (!hasSupabaseConfig()) {
    if (isPublicDemoDataEnabled()) {
      return buildResult(fallbackTherapists, filters, "demo", "demo");
    }

    const degraded = publicDataDegraded<never>({
      operation: "public_therapist_search",
      reason: "configuration_missing",
    });

    return buildResult([], filters, "degraded", "live", {
      correlationId: degraded.correlationId,
      reason: degraded.reason,
    });
  }

  try {
    const rows = await fetchTherapistRows();
    const therapists = rows.map(mapTherapistRow);

    return buildResult(therapists, filters, "success", "live");
  } catch (error) {
    if (isPublicDemoDataEnabled()) {
      return buildResult(fallbackTherapists, filters, "demo", "demo");
    }

    const degraded = publicDataDegraded<never>({
      error,
      operation: "public_therapist_search",
      reason: "query_failed",
    });

    return buildResult([], filters, "degraded", "live", {
      correlationId: degraded.correlationId,
      reason: degraded.reason,
    });
  }
}
