import { fallbackTherapistProfile } from "../fallback";
import {
  mapAvailabilityRows,
  mapContentRow,
  mapProfileRow,
  mapReviewRow,
  mapServiceRow,
  type ContentRow,
  type ProfileRow,
  type ReviewRow,
  type ServiceRow,
} from "../mappers/profile-mapper";
import type { TherapistProfileData } from "../types";

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

async function fetchView<T>(view: string, query: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  const response = await fetch(`${url}/rest/v1/${view}?${query}`, {
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    next: { revalidate: 900, tags: ["therapist-profile"] },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${view}`);
  }

  return (await response.json()) as T[];
}

function slugFilter(slug: string) {
  return encodeURIComponent(slug);
}

export async function getPublicTherapistProfile(
  slug: string,
): Promise<TherapistProfileData | null> {
  if (!hasSupabaseConfig()) {
    return slug === fallbackTherapistProfile.profile.slug
      ? fallbackTherapistProfile
      : null;
  }

  try {
    const [profiles, contents, serviceRows, reviewRows] = await Promise.all([
      fetchView<ProfileRow>(
        "public_therapist_profiles_v",
        `select=*&slug=eq.${slugFilter(slug)}&limit=1`,
      ),
      fetchView<ContentRow>(
        "public_therapist_profile_content_v",
        `select=*&slug=eq.${slugFilter(slug)}&limit=1`,
      ),
      fetchView<ServiceRow>(
        "public_therapist_profile_services_v",
        `select=*&therapist_slug=eq.${slugFilter(slug)}&order=sort_order.asc`,
      ),
      fetchView<ReviewRow>(
        "public_therapist_profile_reviews_v",
        `select=*&therapist_slug=eq.${slugFilter(slug)}&order=published_at.desc&limit=12`,
      ),
    ]);

    const profileRow = profiles[0];
    if (!profileRow) return null;

    const content = mapContentRow(contents[0] ?? null);
    const services = serviceRows.map(mapServiceRow);

    return {
      availability: mapAvailabilityRows(serviceRows),
      profile: mapProfileRow(profileRow, content, services),
      reviews: reviewRows.map(mapReviewRow),
      source: "supabase",
    };
  } catch {
    return slug === fallbackTherapistProfile.profile.slug
      ? fallbackTherapistProfile
      : null;
  }
}

export async function resolvePublicTherapistSlug(slug: string) {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const rows = await fetchView<{ current_slug: string }>(
      "public_therapist_slug_redirects_v",
      `select=current_slug&old_slug=eq.${slugFilter(slug)}&limit=1`,
    );

    return rows[0]?.current_slug ?? null;
  } catch {
    return null;
  }
}
