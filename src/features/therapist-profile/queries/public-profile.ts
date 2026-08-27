import { getPublicServiceAvailability } from "@/features/availability/queries/public-service-availability";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import {
  isPublicDemoDataEnabled,
  publicDataDegraded,
} from "@/lib/public-data-result";

import { getFallbackTherapistProfile } from "../fallback";
import {
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

type PublicTherapyImageRow = {
  hero_image_url: string | null;
  id: string;
  image_url: string | null;
  theme_names: string[] | null;
};

type PublicTherapyPresentation = {
  imageUrl: string | null;
  themeNames: string[];
};

async function getTherapyImages(therapyIds: string[]) {
  const uniqueTherapyIds = Array.from(new Set(therapyIds));
  if (!uniqueTherapyIds.length) {
    return new Map<string, PublicTherapyPresentation>();
  }

  try {
    const rows = await fetchView<PublicTherapyImageRow>(
      "public_therapy_details_v",
      `select=id,hero_image_url,image_url,theme_names&id=in.(${uniqueTherapyIds.join(",")})`,
      { fresh: true },
    );

    return new Map(
      rows.map((row) => [
        row.id,
        {
          imageUrl: row.hero_image_url ?? row.image_url ?? null,
          themeNames: row.theme_names ?? [],
        },
      ]),
    );
  } catch {
    return new Map<string, PublicTherapyPresentation>();
  }
}

type PublicTherapistProfileQueryOptions = {
  fresh?: boolean;
};

export async function getPublicTherapistProfile(
  slug: string,
  options: PublicTherapistProfileQueryOptions = {},
): Promise<TherapistProfileData | null> {
  const result = await getPublicTherapistProfileResult(slug, options);

  return result.status === "success" || result.status === "demo"
    ? result.data
    : null;
}

export async function getPublicTherapistProfileResult(
  slug: string,
  options: PublicTherapistProfileQueryOptions = {},
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
        // Identity is mutable independently from editorial publication. A
        // stale positive match would prevent an old slug from reaching the
        // redirect resolver after a rename.
        { fresh: options.fresh ?? true },
      ),
      fetchView<ContentRow>(
        "public_therapist_profile_content_v",
        `select=*&slug=eq.${slugFilter(slug)}&limit=1`,
        { fresh: options.fresh ?? false },
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
        { fresh: options.fresh ?? false },
      ),
    ]);

    const profileRow = profiles[0];
    if (!profileRow) return { source: "live", status: "not_found" };

    const content = mapContentRow(contents[0] ?? null);
    const availabilityResults = await Promise.all(
      serviceRows.map((service) =>
        getPublicServiceAvailability(service.service_id),
      ),
    );
    if (availabilityResults.some((result) => result.status === "error")) {
      throw new Error("Public service availability is unavailable.");
    }
    const therapyImages = await getTherapyImages(
      serviceRows.map((service) => service.therapy_id),
    );
    const services = serviceRows.map((service, index) =>
      mapServiceRow(
        service,
        availabilityResults[index]?.status === "success"
          ? availabilityResults[index].data.days
          : [],
        therapyImages.get(service.therapy_id)?.imageUrl ?? null,
        therapyImages.get(service.therapy_id)?.themeNames ?? [],
        availabilityResults[index]?.status === "success"
          ? {
              horizonEndsAt: availabilityResults[index].data.horizonEndsAt,
              timezone: availabilityResults[index].data.timezone,
            }
          : null,
      ),
    );

    return {
      data: {
        availability: services[0]?.availability ?? [],
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
      { fresh: true },
    );

    return rows[0]?.current_slug ?? null;
  } catch {
    return null;
  }
}
