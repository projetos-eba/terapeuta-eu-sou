import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type {
  PublicTherapyDetail,
  PublicTherapyDetailRow,
} from "../types/therapy-detail";

function hasSupabaseConfig() {
  return Boolean(getSupabasePublicConfig());
}

async function fetchPublicView<Row>(
  path: string,
  slug: string,
): Promise<Row[]> {
  const config = getSupabasePublicConfig();

  if (!config) return [];

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
    next: { revalidate: 900, tags: [`therapy-detail:${slug}`] },
  });

  if (!response.ok) {
    throw new Error("Public therapy detail fetch failed");
  }

  return (await response.json()) as Row[];
}

function slugFilter(slug: string) {
  return encodeURIComponent(slug);
}

export async function getPublicTherapyDetail(
  slug: string,
): Promise<PublicTherapyDetail | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const rows = await fetchPublicView<PublicTherapyDetailRow>(
      [
      "public_therapy_details_v",
        "?select=id,slug,name,short_description,description,hero_image_url,image_url,therapist_count,category_slug,category_name,subtitle,introduction,complementary_description,safety_note,seo_title,seo_description,approach_label,approach_icon_key,visual_theme_key,hero_focal_point,highlights,benefits,published_at,updated_at,theme_names",
        `&slug=eq.${slugFilter(slug)}`,
        "&limit=1",
      ].join(""),
      slug,
    );

    const row = rows[0];
    return row ? mapTherapyDetail(row) : null;
  } catch {
    return null;
  }
}

export async function resolvePublicTherapySlug(slug: string) {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const rows = await fetchPublicView<{ current_slug: string }>(
      [
        "public_therapy_slug_redirects_v",
        "?select=current_slug",
        `&old_slug=eq.${slugFilter(slug)}`,
        "&limit=1",
      ].join(""),
      slug,
    );

    return rows[0]?.current_slug ?? null;
  } catch {
    return null;
  }
}

function mapTherapyDetail(row: PublicTherapyDetailRow): PublicTherapyDetail {
  return {
    approachIconKey: row.approach_icon_key ?? "sparkles",
    approachLabel: row.approach_label ?? row.category_name,
    benefits: parseItems(row.benefits),
    category: {
      name: row.category_name,
      slug: row.category_slug,
    },
    complementaryDescription: row.complementary_description,
    description: row.description ?? "",
    heroFocalPoint: parseHeroFocalPoint(row.hero_focal_point),
    // Uploads administrativos preenchem `image_url` como imagem canônica. O
    // hero é opcional e, quando ausente, deve manter a mesma apresentação da
    // imagem usada no catálogo público.
    heroImageUrl: row.hero_image_url ?? row.image_url,
    highlights: parseItems(row.highlights),
    id: row.id,
    introduction: row.introduction ?? row.description ?? "",
    name: row.name,
    safetyNote: row.safety_note,
    seoDescription: row.seo_description,
    seoTitle: row.seo_title,
    shortDescription: row.short_description ?? "",
    slug: row.slug,
    subtitle: row.subtitle ?? row.short_description ?? "",
    therapistCount: row.therapist_count ?? 0,
    visualThemeKey: parseVisualThemeKey(row.visual_theme_key),
  };
}

function parseItems<T extends { iconKey: string; title: string }>(
  value: unknown,
): T[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is T =>
        Boolean(item) &&
        typeof item === "object" &&
        "title" in item &&
        "iconKey" in item &&
        typeof item.title === "string" &&
        typeof item.iconKey === "string",
    )
    .map((item) => ({ ...item }));
}

function parseHeroFocalPoint(
  value: string | null,
): PublicTherapyDetail["heroFocalPoint"] {
  if (value === "left" || value === "right") return value;
  return "center";
}

function parseVisualThemeKey(
  value: string | null,
): PublicTherapyDetail["visualThemeKey"] {
  if (value === "oracle" || value === "systemic") return value;
  return "energy";
}
