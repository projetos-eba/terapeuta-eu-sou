import type {
  PublicTherapyDetail,
  PublicTherapyDetailRow,
} from "../types/therapy-detail";

const PLACEHOLDER_SUPABASE_URL = "https://your-project-ref.supabase.co";
const PLACEHOLDER_SUPABASE_ANON_KEY = "replace-with-supabase-anon-key";

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

async function fetchPublicView<Row>(path: string): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return [];

  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    next: { revalidate: 900, tags: ["therapy-detail"] },
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
        "?select=*",
        `&slug=eq.${slugFilter(slug)}`,
        "&limit=1",
      ].join(""),
    );

    const row = rows[0];
    return row ? mapTherapyDetail(row) : null;
  } catch {
    return null;
  }
}

function mapTherapyDetail(row: PublicTherapyDetailRow): PublicTherapyDetail {
  return {
    benefits: parseItems(row.benefits),
    category: {
      name: row.category_name,
      slug: row.category_slug,
    },
    complementaryDescription: row.complementary_description,
    description: row.description ?? "",
    heroImageUrl: row.hero_image_url,
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
