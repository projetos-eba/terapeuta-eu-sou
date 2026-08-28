import { routes } from "@/lib/routes";
import {
  isPublicDemoDataEnabled,
  publicDataDegraded,
  type PublicDataDegradedReason,
} from "@/lib/public-data-result";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";
import { buildPublicTherapistTherapyChips } from "@/features/public-therapists/therapy-presentation";

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
  TherapistSearchTherapy,
} from "./types";

type PublicTherapistSearchRow = {
  therapist_profile_id: string;
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
  schedule_timezone: string | null;
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

type PublicTherapistServiceRow = {
  sort_order: number | null;
  therapist_slug: string;
  therapy_id: string | null;
  therapy_name: string | null;
  therapy_slug: string | null;
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
      // next_slot_at depends on the live slot engine (bookings and holds can
      // change it without a profile publication). The profile agenda already
      // uses no-store, so the discovery card must not serve a stale forecast.
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Public therapist search fetch failed");
  }

  return (await response.json()) as PublicTherapistSearchRow[];
}

async function fetchTherapistServiceRows(therapistSlugs: string[]) {
  const config = getSupabasePublicConfig();

  if (!config || !therapistSlugs.length) return [];

  const response = await fetch(
    `${config.url}/rest/v1/public_therapist_profile_services_v?select=sort_order,therapist_slug,therapy_id,therapy_name,therapy_slug&therapist_slug=in.(${therapistSlugs.join(",")})&order=therapist_slug.asc,sort_order.asc`,
    {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Public therapist services fetch failed");
  }

  return (await response.json()) as PublicTherapistServiceRow[];
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

function mapTherapistRow(
  row: PublicTherapistSearchRow,
  serviceRows: PublicTherapistServiceRow[],
): TherapistSearchCard {
  const rating = row.average_rating ?? 0;
  const reviewCount = row.review_count ?? 0;
  const tags = row.tags?.length
    ? row.tags
    : (row.theme_names?.slice(0, 3) ?? [row.therapy_name]);
  const therapies = buildTherapistTherapyList(row, serviceRows);

  return {
    availabilityBucket: getAvailabilityBucket(
      row.next_slot_at,
      row.schedule_timezone,
    ),
    cityState: [row.city, row.state].filter(Boolean).join(", "),
    description:
      row.therapist_headline?.trim() ||
      "Conheça a apresentação deste terapeuta no perfil completo.",
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
    therapistProfileId: row.therapist_profile_id,
    nextSlotAt: row.next_slot_at,
    nextSlotLabel: formatNextSlotLabel(row.next_slot_at, row.schedule_timezone),
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
    therapies,
    themeSlugs: row.theme_slugs ?? [],
    therapyId: row.therapy_id,
    therapyName: row.therapy_name,
    therapySlug: row.therapy_slug,
  };
}

function buildTherapistTherapyList(
  row: PublicTherapistSearchRow,
  serviceRows: PublicTherapistServiceRow[],
): TherapistSearchTherapy[] {
  const canonicalRows = [
    ...serviceRows,
    {
      sort_order: Number.MAX_SAFE_INTEGER,
      therapist_slug: row.slug,
      therapy_id: row.therapy_id,
      therapy_name: row.therapy_name,
      therapy_slug: row.therapy_slug,
    },
  ];

  return buildPublicTherapistTherapyChips(
    canonicalRows.map((therapy) => ({
      id: therapy.therapy_id,
      name: therapy.therapy_name,
      slug: therapy.therapy_slug,
      sortOrder: therapy.sort_order,
    })),
    Number.MAX_SAFE_INTEGER,
  );
}

function getOptions(therapists: TherapistSearchCard[]) {
  const therapies = new Map<string, TherapistSearchOption>();
  const themes = new Map<string, TherapistSearchOption>();

  therapists.forEach((therapist) => {
    therapist.therapies.forEach((therapy) => {
      therapies.set(therapy.slug, {
        label: therapy.label,
        value: therapy.slug,
      });
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
        ...therapist.therapies.map((therapy) => therapy.label),
        therapist.cityState,
        ...therapist.tags,
      ].join(" "),
    );

    if (!haystack.includes(normalizeSearch(filters.q))) return false;
  }

  if (
    filters.therapy &&
    !therapist.therapies.some((therapy) => therapy.slug === filters.therapy)
  ) {
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
    const serviceRows = await fetchTherapistServiceRows(
      rows.map((row) => row.slug),
    );
    const serviceRowsBySlug = new Map<string, PublicTherapistServiceRow[]>();

    serviceRows.forEach((serviceRow) => {
      const currentRows =
        serviceRowsBySlug.get(serviceRow.therapist_slug) ?? [];
      serviceRowsBySlug.set(serviceRow.therapist_slug, [
        ...currentRows,
        serviceRow,
      ]);
    });

    const therapists = rows.map((row) =>
      mapTherapistRow(row, serviceRowsBySlug.get(row.slug) ?? []),
    );

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
