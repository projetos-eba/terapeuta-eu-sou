import type { MetadataRoute } from "next";

import { routes } from "@/lib/routes";

const PLACEHOLDER_SUPABASE_URL = "https://your-project-ref.supabase.co";
const PLACEHOLDER_SUPABASE_ANON_KEY = "replace-with-supabase-anon-key";

type TherapySitemapRow = {
  slug: string;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const staticRoutes = [
    routes.public.home,
    routes.public.journey,
    routes.public.therapies,
    routes.public.therapists,
    routes.public.forTherapists,
  ];
  const therapies = await getPublishedTherapyRows();

  return [
    ...staticRoutes.map((route) => ({
      changeFrequency: "weekly" as const,
      lastModified: now,
      priority: route === routes.public.home ? 1 : 0.8,
      url: absoluteUrl(siteUrl, route),
    })),
    ...therapies.map((therapy) => ({
      changeFrequency: "weekly" as const,
      lastModified: therapy.updated_at ? new Date(therapy.updated_at) : now,
      priority: 0.7,
      url: absoluteUrl(siteUrl, routes.public.therapyDetail(therapy.slug)),
    })),
  ];
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

function absoluteUrl(siteUrl: string, path: string) {
  return `${siteUrl}${path}`;
}

async function getPublishedTherapyRows() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !anonKey ||
    url === PLACEHOLDER_SUPABASE_URL ||
    anonKey === PLACEHOLDER_SUPABASE_ANON_KEY
  ) {
    return [];
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/public_therapies_v?select=slug,updated_at&order=updated_at.desc`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        next: { revalidate: 900 },
      },
    );

    if (!response.ok) return [];

    return (await response.json()) as TherapySitemapRow[];
  } catch {
    return [];
  }
}
