import "server-only";

import {
  getSupabasePublicConfig as getSharedSupabasePublicConfig,
  invokeSupabaseFunction,
} from "@/lib/supabase/edge-functions";

import {
  fallbackMatchingConfig,
  fallbackMatchingTherapies,
  fallbackMatchingVersionId,
  fallbackMatchingWeights,
} from "./fallback";
import type {
  MatchingConfig,
  MatchingCalculationResult,
  MatchingSelection,
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

type SupabaseConfig = {
  apiKey: string;
  url: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const config = getSharedSupabasePublicConfig();

  if (!config) return null;

  return config;
}

export async function getPublicMatchingConfig(): Promise<MatchingConfig> {
  const config = getSupabaseConfig();

  if (!config) {
    return fallbackMatchingConfig;
  }

  try {
    const rows = await fetchRows<PublicMatchingConfigRow>(
      config,
      "public_matching_config?select=version_id,version,theme_id,theme_name,theme_slug,theme_description,theme_image_url,theme_sort_order,interest_id,interest_name,interest_slug,interest_sort_order&order=theme_sort_order.asc,interest_sort_order.asc",
      config.apiKey,
      300,
    );

    if (!rows.length) {
      return fallbackMatchingConfig;
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
      source: "supabase",
      themes: Array.from(themesById.values()).sort(
        (first, second) => first.sortOrder - second.sortOrder,
      ),
      version: rows[0].version,
      versionId: rows[0].version_id,
    };
  } catch {
    return fallbackMatchingConfig;
  }
}

export async function getMatchingCalculationData(versionId: string) {
  return {
    source: "fallback" as const,
    therapies: fallbackMatchingTherapies,
    versionId: versionId || fallbackMatchingVersionId,
    weights: fallbackMatchingWeights,
  };
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

async function fetchRows<Row>(
  config: SupabaseConfig,
  query: string,
  apiKey: string,
  revalidate?: number,
) {
  const response = await fetch(`${config.url}/rest/v1/${query}`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    next: revalidate ? { revalidate } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Matching Supabase fetch failed: ${response.status}`);
  }

  return (await response.json()) as Row[];
}
