import { routes } from "@/lib/routes";

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
  href_slug: string;
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

function mapTherapy(row: PublicHomeTherapyRow): PublicHomeTherapy {
  return {
    categoryName: row.category_name ?? "Terapia",
    href: routes.public.therapyDetail(row.href_slug || row.slug),
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
    photoUrl: row.photo_url || "/therapists/ana-oliveira.png",
    priceLabel: formatPrice(row.service_price_from_cents),
    ratingLabel: formatRating(row.average_rating),
    reviewCountLabel: formatReviews(row.review_count),
    serviceTitle: row.service_title ?? "Sessao online",
    slug: row.slug,
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
    const [therapyRows, therapistRows, testimonialRows] = await Promise.all([
      fetchPublicHomeRows<PublicHomeTherapyRow>(
        "public_home_therapies",
        "select=category_name,href_slug,is_featured,name,short_description,slug&order=is_featured.desc,name.asc&limit=8",
      ),
      fetchPublicHomeRows<PublicHomeTherapistRow>(
        "public_home_therapists",
        "select=headline,photo_url,public_name,review_count,service_price_from_cents,service_title,slug,average_rating&order=review_count.desc.nullslast,public_name.asc&limit=4",
      ),
      fetchPublicHomeRows<PublicHomeTestimonialRow>(
        "public_home_testimonials",
        "select=author_name,body,context_label,rating&limit=3",
      ),
    ]);

    return {
      source: "supabase",
      testimonials: testimonialRows.length
        ? testimonialRows.map(mapTestimonial)
        : fallbackTestimonials,
      therapies: therapyRows.length
        ? therapyRows.map(mapTherapy)
        : fallbackTherapies,
      therapists: therapistRows.length
        ? therapistRows.map(mapTherapist)
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
