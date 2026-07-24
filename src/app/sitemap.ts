import type { MetadataRoute } from "next";

import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

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
  const config = getSupabasePublicConfig();

  if (!config) {
    return [];
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/public_therapies_v?select=slug,updated_at&order=updated_at.desc`,
      {
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
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
