import { routes } from "@/lib/routes";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";

import {
  fallbackTestimonials,
  fallbackTherapies,
  fallbackTherapists,
} from "./content";
import type {
  PublicHomeData,
  PublicHomeTestimonial,
  PublicHomeTherapist,
  PublicHomeTherapy,
} from "./types";

const PLACEHOLDER_SUPABASE_URL = "https://your-project-ref.supabase.co";
const PLACEHOLDER_SUPABASE_ANON_KEY = "replace-with-supabase-anon-key";

type PublicHomeTherapyRow = {
  category_name: string | null;
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

type PublicHomeTherapistContentRow = {
  guide_items: Array<{ label?: string | null }> | null;
  slug: string;
};

type PublicHomeTherapistServiceRow = {
  therapist_slug: string;
  therapy_name: string | null;
};

type PublicHomeTestimonialRow = {
  author_name: string | null;
  body: string;
  context_label: string | null;
  rating: number | null;
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

async function fetchPublicHomeRows<Row>(
  view: string,
  query: string,
): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return [];
  }

  const response = await fetch(`${url}/rest/v1/${view}?${query}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Public home fetch failed for ${view}`);
  }

  return (await response.json()) as Row[];
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
    return "Sem avaliacoes publicadas";
  }

  return `${count} ${count === 1 ? "avaliacao" : "avaliacoes"}`;
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

function extractTherapyNamesFromText(text: string | null | undefined) {
  if (!text) {
    return [];
  }

  const knownTherapies = [
    "Reiki",
    "Tarô",
    "Tarot",
    "Aromaterapia",
    "Constelação Familiar",
    "Constelacao Familiar",
  ];

  return knownTherapies
    .filter((therapyName) =>
      text.toLocaleLowerCase("pt-BR").includes(
        therapyName.toLocaleLowerCase("pt-BR"),
      ),
    )
    .map((therapyName) =>
      therapyName === "Tarot"
        ? "Tarô"
        : therapyName === "Constelacao Familiar"
          ? "Constelação Familiar"
          : therapyName,
    )
    .filter((therapyName, index, all) => all.indexOf(therapyName) === index);
}

function mapTherapy(row: PublicHomeTherapyRow): PublicHomeTherapy {
  return {
    categoryName: row.category_name ?? "Terapia",
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
    name: row.public_name,
    photoUrl:
      getTherapistAvatarUrl(row.photo_url, {
        name: row.public_name,
        slug: row.slug,
      }) || "/therapists/ana-oliveira.png",
    priceLabel: formatPrice(row.service_price_from_cents),
    ratingLabel: formatRating(row.average_rating),
    reviewCountLabel: formatReviews(row.review_count),
    serviceTitle: row.service_title ?? "Sessao online",
    slug: row.slug,
    therapyNames: extractTherapyNamesFromText(
      `${row.headline ?? ""} ${row.service_title ?? ""}`,
    ),
  };
}

function mapTestimonial(row: PublicHomeTestimonialRow): PublicHomeTestimonial {
  return {
    author: row.author_name ?? "Paciente TES",
    body: row.body,
    context: row.context_label ?? "Depoimento publicado",
    ratingLabel: formatRating(row.rating),
  };
}

function completeFeaturedTherapists(
  therapists: PublicHomeTherapist[],
): PublicHomeTherapist[] {
  if (therapists.length >= 5) {
    return therapists.slice(0, 5);
  }

  const currentSlugs = new Set(therapists.map((therapist) => therapist.slug));
  const complementaryTherapists = fallbackTherapists.filter(
    (therapist) => !currentSlugs.has(therapist.slug),
  );

  return [...therapists, ...complementaryTherapists].slice(0, 5);
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
  const therapiesBySlug = new Map<string, string[]>();

  for (const row of serviceRows) {
    const therapyName = row.therapy_name?.trim();

    if (!therapyName) {
      continue;
    }

    const currentTherapies = therapiesBySlug.get(row.therapist_slug) ?? [];

    if (!currentTherapies.includes(therapyName)) {
      therapiesBySlug.set(row.therapist_slug, [
        ...currentTherapies,
        therapyName,
      ]);
    }
  }

  return therapists.map((therapist) => {
    const therapyNames = therapiesBySlug.get(therapist.slug);

    if (!therapyNames?.length) {
      return therapist;
    }

    return {
      ...therapist,
      therapyNames,
    };
  });
}

export async function getPublicHomeData(): Promise<PublicHomeData> {
  if (!hasSupabaseConfig()) {
    return {
      source: "fallback",
      testimonials: fallbackTestimonials,
      therapies: fallbackTherapies,
      therapists: fallbackTherapists,
    };
  }

  try {
    const [therapyRows, therapistRows, therapistContentRows, testimonialRows] =
      await Promise.all([
        fetchPublicHomeRows<PublicHomeTherapyRow>(
          "public_therapies_v",
          "select=category_name,slug,is_featured,name,short_description,image_url&order=is_popular.desc,popularity_score.desc,name.asc&limit=8",
        ),
        fetchPublicHomeRows<PublicHomeTherapistRow>(
          "public_home_therapists",
          "select=headline,photo_url,public_name,review_count,service_price_from_cents,service_title,slug,average_rating&order=review_count.desc.nullslast,public_name.asc&limit=5",
        ),
        fetchPublicHomeRows<PublicHomeTherapistContentRow>(
          "public_therapist_profile_content_v",
          "select=slug,guide_items",
        ),
        fetchPublicHomeRows<PublicHomeTestimonialRow>(
          "public_home_testimonials",
          "select=author_name,body,context_label,rating&limit=3",
        ),
      ]);

    const therapistSlugs = therapistRows.map((row) => row.slug);
    const therapistServiceRows = therapistSlugs.length
      ? await fetchPublicHomeRows<PublicHomeTherapistServiceRow>(
          "public_therapist_profile_services_v",
          `select=therapist_slug,therapy_name&therapist_slug=in.(${therapistSlugs.join(",")})&order=sort_order.asc`,
        )
      : [];

    const mappedTherapists = applyTherapistServices(
      applyTherapistContent(therapistRows.map(mapTherapist), therapistContentRows),
      therapistServiceRows,
    );

    return {
      source: "supabase",
      testimonials: testimonialRows.length
        ? testimonialRows.map(mapTestimonial)
        : fallbackTestimonials,
      therapies: therapyRows.length
        ? therapyRows.map(mapTherapy)
        : fallbackTherapies,
      therapists: therapistRows.length
        ? completeFeaturedTherapists(mappedTherapists)
        : fallbackTherapists,
    };
  } catch {
    return {
      source: "fallback",
      testimonials: fallbackTestimonials,
      therapies: fallbackTherapies,
      therapists: fallbackTherapists,
    };
  }
}
