import { routes } from "@/lib/routes";
import {
  createPublicDataCorrelationId,
  isPublicDemoDataEnabled,
  logPublicDataFailure,
} from "@/lib/public-data-result";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";
import { buildPublicTherapistTherapyChips } from "@/features/public-therapists/therapy-presentation";

import {
  fallbackTestimonials,
  fallbackTherapies,
  fallbackTherapists,
} from "./content";
import type {
  PublicHomeData,
  PublicHomeFeaturedTherapistsPage,
  PublicHomeTestimonial,
  PublicHomeTherapist,
  PublicHomeTherapy,
} from "./types";

type PublicHomeTherapyRow = {
  theme_names: string[] | null;
  href_slug?: string;
  image_url: string | null;
  is_featured: boolean | null;
  name: string;
  short_description: string;
  slug: string;
};

type PublicHomeTherapistRow = {
  headline: string | null;
  photo_url: string | null;
  public_name: string;
  review_count: number | null;
  service_price_from_cents: number | null;
  service_title: string | null;
  slug: string;
  average_rating: number | null;
};

type PublicHomeTherapistPlanRow = {
  plan: "free" | "premium" | "premium_plus";
  slug: string;
};

type PublicHomeTherapistContentRow = {
  guide_items: Array<{ label?: string | null }> | null;
  slug: string;
};

type PublicHomeTherapistServiceRow = {
  sort_order: number | null;
  therapist_slug: string;
  therapy_id: string | null;
  therapy_name: string | null;
  therapy_slug: string | null;
};

type PublicHomeTestimonialRow = {
  author_name: string | null;
  body: string;
  context_label: string | null;
  rating: number | null;
};

type PublicHomeTherapistPlanPage = {
  rows: PublicHomeTherapistPlanRow[];
  total: number;
};

type FeaturedTherapistsCursor = {
  freeOffset: number;
  paidOffset: number;
};

const FEATURED_THERAPISTS_PAGE_SIZE = 6;

function hasSupabaseConfig() {
  return Boolean(getSupabasePublicConfig());
}

async function fetchPublicHomeRows<Row>(
  view: string,
  query: string,
): Promise<Row[]> {
  const config = getSupabasePublicConfig();

  if (!config) {
    return [];
  }

  const response = await fetch(`${config.url}/rest/v1/${view}?${query}`, {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Public home fetch failed for ${view}`);
  }

  return (await response.json()) as Row[];
}

async function fetchPublicHomeRowsWithCount<Row>(
  view: string,
  query: string,
): Promise<{ rows: Row[]; total: number }> {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error("Public home Supabase configuration is unavailable");
  }

  const response = await fetch(`${config.url}/rest/v1/${view}?${query}`, {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      Prefer: "count=exact",
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Public home fetch failed for ${view}`);
  }

  const rows = (await response.json()) as Row[];
  const contentRange = response.headers?.get("content-range");
  const total = contentRange ? Number(contentRange.split("/")[1]) : rows.length;

  return {
    rows,
    total: Number.isFinite(total) ? total : rows.length,
  };
}

function formatPrice(cents: number | null) {
  if (typeof cents !== "number") {
    return "Valor informado no perfil";
  }

  return `A partir de ${new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100)}`;
}

function formatRating(rating: number | null) {
  if (typeof rating !== "number") {
    return "Novo";
  }

  return rating.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function formatReviews(count: number | null) {
  if (!count) {
    return "Sem avaliações publicadas";
  }

  return `${count} ${count === 1 ? "avaliação" : "avaliações"}`;
}

function normalizeGuideItems(
  items: Array<{ label?: string | null }> | null | undefined,
) {
  const labels =
    items
      ?.map((item) => item.label?.trim())
      .filter((label): label is string => Boolean(label)) ?? [];

  if (labels.length < 3) {
    return [];
  }

  return labels.slice(0, 6);
}

function mapTherapy(row: PublicHomeTherapyRow): PublicHomeTherapy {
  return {
    themeName: row.theme_names?.[0] ?? "Terapia",
    href: routes.public.therapyDetail(row.href_slug || row.slug),
    imageUrl: row.image_url,
    isFeatured: Boolean(row.is_featured),
    name: row.name,
    shortDescription: row.short_description,
    slug: row.slug,
  };
}

function mapTherapist(row: PublicHomeTherapistRow): PublicHomeTherapist {
  return {
    headline: row.headline ?? "Terapeuta TES",
    href: routes.public.therapistProfile(row.slug),
    isPremium: false,
    name: row.public_name,
    photoUrl:
      getTherapistAvatarUrl(row.photo_url, {
        name: row.public_name,
        slug: row.slug,
      }) || "/therapists/ana-oliveira.png",
    priceLabel: formatPrice(row.service_price_from_cents),
    ratingLabel: formatRating(row.average_rating),
    reviewCountLabel: formatReviews(row.review_count),
    serviceTitle: row.service_title ?? "Sessão online",
    slug: row.slug,
  };
}

function applyTherapistPremiumStatus(
  therapists: PublicHomeTherapist[],
  planRows: PublicHomeTherapistPlanRow[],
) {
  const premiumSlugs = new Set(
    planRows.filter((row) => row.plan !== "free").map((row) => row.slug),
  );

  return therapists.map((therapist) => ({
    ...therapist,
    isPremium: premiumSlugs.has(therapist.slug),
  }));
}

function mapTestimonial(row: PublicHomeTestimonialRow): PublicHomeTestimonial {
  return {
    author: row.author_name ?? "Paciente TES",
    body: row.body,
    context: row.context_label ?? "Depoimento publicado",
    ratingLabel: formatRating(row.rating),
  };
}

function applyTherapistContent(
  therapists: PublicHomeTherapist[],
  contentRows: PublicHomeTherapistContentRow[],
) {
  const contentBySlug = new Map(
    contentRows.map((row) => [row.slug, normalizeGuideItems(row.guide_items)]),
  );

  return therapists.map((therapist) => {
    const guideItems = contentBySlug.get(therapist.slug);

    if (!guideItems?.length) {
      return therapist;
    }

    return {
      ...therapist,
      guideItems,
    };
  });
}

function applyTherapistServices(
  therapists: PublicHomeTherapist[],
  serviceRows: PublicHomeTherapistServiceRow[],
) {
  const therapiesBySlug = new Map<string, PublicHomeTherapistServiceRow[]>();

  for (const row of serviceRows) {
    if (!row.therapy_name?.trim()) {
      continue;
    }

    const currentTherapies = therapiesBySlug.get(row.therapist_slug) ?? [];
    therapiesBySlug.set(row.therapist_slug, [...currentTherapies, row]);
  }

  return therapists.map((therapist) => {
    const therapyRows = therapiesBySlug.get(therapist.slug);

    if (!therapyRows?.length) {
      return therapist;
    }

    const therapies = buildPublicTherapistTherapyChips(
      therapyRows.map((row) => ({
        id: row.therapy_id,
        name: row.therapy_name,
        slug: row.therapy_slug,
        sortOrder: row.sort_order,
      })),
      3,
    );

    return {
      ...therapist,
      therapies,
      therapyNames: therapies.map((therapy) => therapy.label),
    };
  });
}

function getFeaturedTherapistIdentity(therapist: PublicHomeTherapist) {
  return `${therapist.name.trim().toLocaleLowerCase("pt-BR")}|${therapist.photoUrl}`;
}

function deduplicateFeaturedTherapists(therapists: PublicHomeTherapist[]) {
  const displayedIdentities = new Set<string>();

  return therapists.filter((therapist) => {
    const identity = getFeaturedTherapistIdentity(therapist);

    if (displayedIdentities.has(identity)) {
      return false;
    }

    displayedIdentities.add(identity);
    return true;
  });
}

async function fetchTherapistPlanPage(
  planFilter: "free" | "paid",
  offset: number,
  limit: number,
): Promise<PublicHomeTherapistPlanPage> {
  const plans = planFilter === "paid" ? "premium,premium_plus" : "free";
  const result = await fetchPublicHomeRowsWithCount<PublicHomeTherapistPlanRow>(
    "public_therapist_profiles_v",
    `select=slug,plan&plan=in.(${plans})&order=review_count.desc.nullslast,public_name.asc,slug.asc&limit=${limit}&offset=${offset}`,
  );

  return { rows: result.rows, total: result.total };
}

async function hydrateFeaturedTherapists(
  planRows: PublicHomeTherapistPlanRow[],
): Promise<PublicHomeTherapist[]> {
  const therapistSlugs = planRows.map((row) => row.slug);

  if (!therapistSlugs.length) {
    return [];
  }

  const slugs = therapistSlugs.join(",");
  const [therapistRows, therapistContentRows, therapistServiceRows] =
    await Promise.all([
      fetchPublicHomeRows<PublicHomeTherapistRow>(
        "public_home_therapists",
        `select=headline,photo_url,public_name,review_count,service_price_from_cents,service_title,slug,average_rating&slug=in.(${slugs})`,
      ),
      fetchPublicHomeRows<PublicHomeTherapistContentRow>(
        "public_therapist_profile_content_v",
        `select=slug,guide_items&slug=in.(${slugs})`,
      ),
      fetchPublicHomeRows<PublicHomeTherapistServiceRow>(
        "public_therapist_profile_services_v",
        `select=therapist_slug,therapy_id,therapy_name,therapy_slug,sort_order&therapist_slug=in.(${slugs})&order=sort_order.asc`,
      ),
    ]);
  const therapistsBySlug = new Map(
    therapistRows.map((row) => [row.slug, mapTherapist(row)]),
  );
  const orderedTherapists = planRows
    .map((planRow) => therapistsBySlug.get(planRow.slug))
    .filter((therapist): therapist is PublicHomeTherapist =>
      Boolean(therapist),
    );

  return applyTherapistPremiumStatus(
    applyTherapistServices(
      applyTherapistContent(orderedTherapists, therapistContentRows),
      therapistServiceRows,
    ),
    planRows,
  );
}

export async function getPublicHomeFeaturedTherapistsPage(
  cursor: FeaturedTherapistsCursor = { freeOffset: 0, paidOffset: 0 },
): Promise<PublicHomeFeaturedTherapistsPage> {
  const paidPage = await fetchTherapistPlanPage(
    "paid",
    cursor.paidOffset,
    FEATURED_THERAPISTS_PAGE_SIZE,
  );
  const shouldIncludeFree = paidPage.total < 5;
  const remainingSlots = FEATURED_THERAPISTS_PAGE_SIZE - paidPage.rows.length;
  const freePage =
    shouldIncludeFree && remainingSlots > 0
      ? await fetchTherapistPlanPage("free", cursor.freeOffset, remainingSlots)
      : { rows: [], total: 0 };
  const selectedPlanRows = [...paidPage.rows, ...freePage.rows];
  const nextCursor = {
    freeOffset: cursor.freeOffset + freePage.rows.length,
    paidOffset: cursor.paidOffset + paidPage.rows.length,
  };
  const hasMore = shouldIncludeFree
    ? nextCursor.paidOffset < paidPage.total ||
      nextCursor.freeOffset < freePage.total
    : nextCursor.paidOffset < paidPage.total;

  return {
    hasMore,
    nextCursor: hasMore ? nextCursor : null,
    therapists: deduplicateFeaturedTherapists(
      await hydrateFeaturedTherapists(selectedPlanRows),
    ),
  };
}

export async function getPublicHomeData(): Promise<PublicHomeData> {
  if (!hasSupabaseConfig()) {
    return homeUnavailable("configuration_missing");
  }

  try {
    const [therapyRows, featuredTherapistsPage, testimonialRows] =
      await Promise.all([
        fetchPublicHomeRows<PublicHomeTherapyRow>(
          "public_therapies_v",
          "select=theme_names,slug,is_featured,name,short_description,image_url&order=is_popular.desc,popularity_score.desc,name.asc&limit=8",
        ),
        getPublicHomeFeaturedTherapistsPage(),
        fetchPublicHomeRows<PublicHomeTestimonialRow>(
          "public_home_testimonials",
          "select=author_name,body,context_label,rating&limit=3",
        ),
      ]);

    return {
      source: "supabase",
      status: featuredTherapistsPage.therapists.length ? "success" : "empty",
      testimonials: testimonialRows.map(mapTestimonial),
      therapies: therapyRows.map(mapTherapy),
      therapists: featuredTherapistsPage.therapists,
      featuredTherapistsPage,
    };
  } catch (error) {
    return homeUnavailable("query_failed", error);
  }
}

function homeUnavailable(
  reason: "configuration_missing" | "query_failed",
  error?: unknown,
): PublicHomeData {
  if (isPublicDemoDataEnabled()) {
    return {
      source: "demo",
      status: "demo",
      testimonials: fallbackTestimonials,
      therapies: fallbackTherapies,
      therapists: fallbackTherapists,
      featuredTherapistsPage: {
        hasMore: false,
        nextCursor: null,
        therapists: fallbackTherapists,
      },
    };
  }

  const correlationId = createPublicDataCorrelationId();

  logPublicDataFailure({
    correlationId,
    error,
    operation: "public-home",
    reason,
  });

  return {
    correlationId,
    reason,
    source: "supabase",
    status: "degraded",
    testimonials: [],
    therapies: [],
    therapists: [],
  };
}
