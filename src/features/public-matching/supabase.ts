import "server-only";

import {
  getSupabasePublicConfig as getSharedSupabasePublicConfig,
  invokeSupabaseFunction,
} from "@/lib/supabase/edge-functions";
import {
  createPublicDataCorrelationId,
  isPublicDemoDataEnabled,
  logPublicDataFailure,
} from "@/lib/public-data-result";

import {
  fallbackMatchingConfig,
  fallbackMatchingTherapies,
  fallbackMatchingVersionId,
  fallbackMatchingWeights,
} from "./fallback";
import type {
  MatchingCalculationResult,
  MatchingConfig,
  MatchingConfigResult,
  MatchingUnavailableReason,
  MatchingSelection,
  MatchingTherapy,
  MatchingWeight,
} from "./types";

type PublicMatchingConfigRow = {
  interest_id: string | null;
  interest_name: string | null;
  interest_slug: string | null;
  interest_sort_order: number | null;
  theme_description: string;
  theme_id: string;
  theme_image_url: string | null;
  theme_name: string;
  theme_slug: string;
  theme_sort_order: number;
  version: number;
  version_id: string;
};

type PublicMatchingTherapyThemeRow = {
  sort_order: number;
  theme_id: string;
  therapy_id: string;
};

type PublicMatchingTherapyRow = {
  description: string | null;
  id: string;
  image_url: string | null;
  is_visible_in_matching: boolean;
  name: string;
  short_description: string;
  slug: string;
  status: MatchingTherapy["status"];
  therapist_count: number | null;
};

type SupabaseConfig = {
  apiKey: string;
  url: string;
};

type MatchingCalculationDataResult =
  | {
      source: "supabase";
      status: "success";
      therapies: MatchingTherapy[];
      versionId: string;
      weights: MatchingWeight[];
    }
  | {
      source: "demo";
      status: "demo";
      therapies: MatchingTherapy[];
      versionId: string;
      weights: MatchingWeight[];
    }
  | {
      correlationId: string;
      reason: MatchingUnavailableReason;
      source: "supabase";
      status: "unavailable";
    };

function getSupabaseConfig(): SupabaseConfig | null {
  const config = getSharedSupabasePublicConfig();

  if (!config) return null;

  return config;
}

export async function getPublicMatchingConfig(): Promise<MatchingConfigResult> {
  const config = getSupabaseConfig();

  if (!config) {
    return matchingUnavailable("configuration_missing", "matching.config");
  }

  try {
    const rows = await fetchRows<PublicMatchingConfigRow>(
      config,
      "public_matching_config?select=version_id,version,theme_id,theme_name,theme_slug,theme_description,theme_image_url,theme_sort_order,interest_id,interest_name,interest_slug,interest_sort_order&order=theme_sort_order.asc,interest_sort_order.asc",
      config.apiKey,
    );

    if (!rows.length) {
      return matchingUnavailable("version_unavailable", "matching.config");
    }

    const themesById = new Map<string, MatchingConfig["themes"][number]>();

    rows.forEach((row) => {
      const theme = themesById.get(row.theme_id) ?? {
        description: row.theme_description,
        id: row.theme_id,
        imageUrl: row.theme_image_url,
        interests: [],
        name: row.theme_name,
        slug: row.theme_slug,
        sortOrder: row.theme_sort_order,
      };

      if (row.interest_id && row.interest_name && row.interest_slug) {
        theme.interests.push({
          id: row.interest_id,
          name: row.interest_name,
          slug: row.interest_slug,
          sortOrder: row.interest_sort_order ?? 0,
          themeId: row.theme_id,
        });
      }

      themesById.set(row.theme_id, theme);
    });

    return {
      config: {
        source: "supabase",
        themes: Array.from(themesById.values()).sort(
          (first, second) => first.sortOrder - second.sortOrder,
        ),
        version: rows[0].version,
        versionId: rows[0].version_id,
      },
      source: "supabase",
      status: "success",
    };
  } catch (error) {
    return matchingUnavailable("query_failed", "matching.config", error);
  }
}

export async function getMatchingCalculationData(
  versionId: string,
): Promise<MatchingCalculationDataResult> {
  const config = getSupabaseConfig();

  if (config) {
    try {
      const [therapies, themeRows] = await Promise.all([
        fetchRows<PublicMatchingTherapyRow>(
          config,
          "public_matching_therapies_v?select=id,name,slug,short_description,description,image_url,status,therapist_count,is_visible_in_matching",
          config.apiKey,
        ),
        fetchRows<PublicMatchingTherapyThemeRow>(
          config,
          "public_matching_therapy_themes_v?select=therapy_id,theme_id,sort_order&order=sort_order.asc",
          config.apiKey,
        ),
      ]);
      const themeIdsByTherapy = new Map<string, string[]>();
      const sortOrderByTherapy = new Map<string, number>();

      for (const row of themeRows) {
        themeIdsByTherapy.set(row.therapy_id, [
          ...(themeIdsByTherapy.get(row.therapy_id) ?? []),
          row.theme_id,
        ]);
        sortOrderByTherapy.set(
          row.therapy_id,
          Math.min(sortOrderByTherapy.get(row.therapy_id) ?? row.sort_order, row.sort_order),
        );
      }

      return {
        source: "supabase" as const,
        status: "success" as const,
        therapies: therapies.map((therapy) => ({
          description: therapy.description ?? therapy.short_description,
          id: therapy.id,
          imageUrl: therapy.image_url,
          isVisibleInMatching: therapy.is_visible_in_matching,
          name: therapy.name,
          shortDescription: therapy.short_description,
          slug: therapy.slug,
          sortOrder: sortOrderByTherapy.get(therapy.id) ?? 9999,
          status: therapy.status,
          therapistCount: therapy.therapist_count ?? 0,
          themeIds: themeIdsByTherapy.get(therapy.id) ?? [],
        })),
        versionId: versionId || fallbackMatchingVersionId,
        weights: [],
      };
    } catch (error) {
      return matchingCalculationUnavailable(
        "query_failed",
        "matching.calculate",
        versionId,
        error,
      );
    }
  }

  return matchingCalculationUnavailable(
    "configuration_missing",
    "matching.calculate",
    versionId,
  );
}

export async function calculateMatchingWithFunction(
  selection: MatchingSelection,
  versionId: string,
): Promise<MatchingCalculationResult | null> {
  const config = getSupabaseConfig();

  if (!config) return null;

  try {
    return await invokeSupabaseFunction<MatchingCalculationResult>(
      config,
      "matching-calculate",
      {
        body: {
          interestIds: selection.interestIds,
          matchingVersionId: selection.matchingVersionId,
          source: selection.source,
          themeIds: selection.themeIds,
          versionId,
        },
      },
    );
  } catch {
    return null;
  }
}

function matchingUnavailable(
  reason: MatchingUnavailableReason,
  operation: string,
  error?: unknown,
): MatchingConfigResult {
  if (isPublicDemoDataEnabled()) {
    return {
      config: fallbackMatchingConfig,
      source: "demo",
      status: "demo",
    };
  }

  const correlationId = createPublicDataCorrelationId();

  logPublicDataFailure({
    correlationId,
    error,
    operation,
    reason: reason === "version_unavailable" ? "invalid_response" : reason,
  });

  return {
    correlationId,
    reason,
    source: "supabase",
    status: "unavailable",
  };
}

function matchingCalculationUnavailable(
  reason: MatchingUnavailableReason,
  operation: string,
  versionId: string,
  error?: unknown,
): MatchingCalculationDataResult {
  if (isPublicDemoDataEnabled()) {
    return {
      source: "demo",
      status: "demo",
      therapies: fallbackMatchingTherapies,
      versionId: versionId || fallbackMatchingVersionId,
      weights: fallbackMatchingWeights,
    };
  }

  const correlationId = createPublicDataCorrelationId();

  logPublicDataFailure({
    correlationId,
    error,
    operation,
    reason: toPublicDataReason(reason),
  });

  return {
    correlationId,
    reason,
    source: "supabase",
    status: "unavailable",
  };
}

function toPublicDataReason(reason: MatchingUnavailableReason) {
  return reason === "version_unavailable" ? "invalid_response" : reason;
}

async function fetchRows<Row>(
  config: SupabaseConfig,
  query: string,
  apiKey: string,
) {
  const response = await fetch(`${config.url}/rest/v1/${query}`, {
    cache: "no-store",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Matching Supabase fetch failed: ${response.status}`);
  }

  return (await response.json()) as Row[];
}
