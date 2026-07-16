import "server-only";

import {
  fallbackMatchingConfig,
  fallbackMatchingTherapies,
  fallbackMatchingVersionId,
  fallbackMatchingWeights,
} from "./fallback";
import type {
  MatchingConfig,
  MatchingTherapy,
  MatchingWeight,
} from "./types";

const PLACEHOLDER_SUPABASE_URL = "https://your-project-ref.supabase.co";
const PLACEHOLDER_SUPABASE_ANON_KEY = "replace-with-supabase-anon-key";
const PLACEHOLDER_SERVICE_ROLE_KEY = "replace-with-supabase-service-role-key";

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

type MatchingTherapyRow = {
  description: string | null;
  id: string;
  name: string;
  short_description: string;
  slug: string;
  status: MatchingTherapy["status"];
  therapist_count?: number | null;
};

type MatchingTherapyCountRow = {
  therapist_count: number | null;
  therapy_id: string;
};

type MatchingTherapySettingRow = {
  is_visible_in_matching: boolean;
  therapy_id: string;
};

type MatchingTherapyDataRow = MatchingTherapyRow & {
  therapist_count: number | null;
  is_visible_in_matching: boolean;
};

type MatchingWeightRow = {
  interest_id: string | null;
  is_active: boolean;
  theme_id: string | null;
  therapy_id: string;
  weight: number | string;
};

type SupabaseConfig = {
  anonKey: string;
  serviceRoleKey?: string;
  url: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !anonKey ||
    url === PLACEHOLDER_SUPABASE_URL ||
    anonKey === PLACEHOLDER_SUPABASE_ANON_KEY
  ) {
    return null;
  }

  return {
    anonKey,
    serviceRoleKey:
      serviceRoleKey && serviceRoleKey !== PLACEHOLDER_SERVICE_ROLE_KEY
        ? serviceRoleKey
        : undefined,
    url: url.replace(/\/$/, ""),
  };
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
      config.anonKey,
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
  const config = getSupabaseConfig();

  if (!config?.serviceRoleKey) {
    return {
      source: "fallback" as const,
      therapies: fallbackMatchingTherapies,
      versionId: fallbackMatchingVersionId,
      weights: fallbackMatchingWeights,
    };
  }

  try {
    const [therapyRows, settingRows, countRows, weightRows] = await Promise.all([
      fetchRows<MatchingTherapyRow>(
        config,
        "public_therapies_v?select=id,name,slug,short_description,description,status,therapist_count",
        config.serviceRoleKey,
      ),
      fetchRows<MatchingTherapySettingRow>(
        config,
        "matching_therapy_settings?select=therapy_id,is_visible_in_matching",
        config.serviceRoleKey,
      ),
      fetchRows<MatchingTherapyCountRow>(
        config,
        "public_matching_therapist_counts?select=therapy_id,therapist_count",
        config.serviceRoleKey,
      ),
      fetchRows<MatchingWeightRow>(
        config,
        `matching_weights?select=therapy_id,theme_id,interest_id,weight,is_active&version_id=eq.${encodeURIComponent(
          versionId,
        )}&is_active=eq.true`,
        config.serviceRoleKey,
      ),
    ]);

    return {
      source: "supabase" as const,
      therapies: mergeTherapyRows(therapyRows, settingRows, countRows).map(
        mapTherapyRow,
      ),
      versionId,
      weights: weightRows.map(mapWeightRow),
    };
  } catch {
    return {
      source: "fallback" as const,
      therapies: fallbackMatchingTherapies,
      versionId: fallbackMatchingVersionId,
      weights: fallbackMatchingWeights,
    };
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

function mapTherapyRow(row: MatchingTherapyDataRow): MatchingTherapy {
  return {
    description: row.description ?? row.short_description,
    id: row.id,
    imageUrl: null,
    isVisibleInMatching: row.is_visible_in_matching,
    name: row.name,
    shortDescription: row.short_description,
    slug: row.slug,
    status: row.status,
    therapistCount: row.therapist_count ?? 0,
  };
}

function mergeTherapyRows(
  therapies: MatchingTherapyRow[],
  settings: MatchingTherapySettingRow[],
  counts: MatchingTherapyCountRow[],
): MatchingTherapyDataRow[] {
  const settingsByTherapyId = new Map(
    settings.map((setting) => [setting.therapy_id, setting]),
  );
  const countsByTherapyId = new Map(counts.map((count) => [count.therapy_id, count]));

  return therapies.map((therapy) => ({
    ...therapy,
    is_visible_in_matching:
      settingsByTherapyId.get(therapy.id)?.is_visible_in_matching ?? true,
    therapist_count:
      countsByTherapyId.get(therapy.id)?.therapist_count ??
      therapy.therapist_count ??
      0,
  }));
}

function mapWeightRow(row: MatchingWeightRow): MatchingWeight {
  return {
    interestId: row.interest_id,
    isActive: row.is_active,
    themeId: row.theme_id,
    therapyId: row.therapy_id,
    weight: Number(row.weight),
  };
}
