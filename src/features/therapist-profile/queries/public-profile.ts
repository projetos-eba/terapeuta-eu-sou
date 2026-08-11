import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import {
  isPublicDemoDataEnabled,
  publicDataDegraded,
} from "@/lib/public-data-result";

import { getFallbackTherapistProfile } from "../fallback";
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
import type { PublicTherapistProfileResult } from "../types";

function hasSupabaseConfig() {
  return Boolean(getSupabasePublicConfig());
}

async function fetchView<T>(
  view: string,
  query: string,
  options: { fresh?: boolean } = {},
) {
  const config = getSupabasePublicConfig();
  if (!config) return [];

  const response = await fetch(`${config.url}/rest/v1/${view}?${query}`, {
    ...(options.fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: 900, tags: ["therapist-profile"] } }),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      apikey: config.apiKey,
    },
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
  const result = await getPublicTherapistProfileResult(slug);

  return result.status === "success" || result.status === "demo"
    ? result.data
    : null;
}

export async function getPublicTherapistProfileResult(
  slug: string,
): Promise<PublicTherapistProfileResult> {
  if (!hasSupabaseConfig()) {
    if (isPublicDemoDataEnabled()) {
      const demo = getFallbackTherapistProfile(slug);
      return demo
        ? { data: demo, source: "demo", status: "demo" }
        : { source: "live", status: "not_found" };
    }

    return publicDataDegraded({
      operation: "public_therapist_profile",
      reason: "configuration_missing",
    });
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
        // Availability and booking conflicts must never inherit the profile cache.
        { fresh: true },
      ),
      fetchView<ReviewRow>(
        "public_therapist_profile_reviews_v",
        `select=*&therapist_slug=eq.${slugFilter(slug)}&order=published_at.desc&limit=12`,
      ),
    ]);

    const profileRow = profiles[0];
    if (!profileRow) return { source: "live", status: "not_found" };

    const content = mapContentRow(contents[0] ?? null);
    const services = serviceRows.map(mapServiceRow);

    return {
      data: {
        availability: mapAvailabilityRows(serviceRows),
        profile: mapProfileRow(profileRow, content, services),
        reviews: reviewRows.map(mapReviewRow),
        source: "live",
      },
      source: "live",
      status: "success",
    };
  } catch (error) {
    if (isPublicDemoDataEnabled()) {
      const demo = getFallbackTherapistProfile(slug);
      return demo
        ? { data: demo, source: "demo", status: "demo" }
        : { source: "live", status: "not_found" };
    }

    return publicDataDegraded({
      error,
      operation: "public_therapist_profile",
      reason: "query_failed",
    });
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
