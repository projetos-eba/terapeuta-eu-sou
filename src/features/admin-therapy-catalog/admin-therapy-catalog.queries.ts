import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { parseAdminTherapyCatalogContract } from "./admin-therapy-catalog.parsers";
import type { AdminTherapyCatalogContract } from "./admin-therapy-catalog.types";

type EdgeEnvelope<T> =
  | { data: T; ok: true }
  | {
      error?: {
        code?: string;
        message?: string;
        requestId?: string;
      };
      ok: false;
    };

export type AdminTherapyCatalogPageResult =
  | {
      catalog: AdminTherapyCatalogContract;
      status: "success";
    }
  | {
      message: string;
      requestId?: string;
      status: "error";
    };

export const getAdminTherapyCatalogPage = cache(
  async function getAdminTherapyCatalogPage({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<AdminTherapyCatalogPageResult> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Configuração Supabase ausente para carregar o catálogo.",
        status: "error",
      };
    }

    try {
      const payload = await callAdminTherapyCatalogEdge<unknown>(
        config.url,
        accessToken,
        { action: "list" },
      );
      const enrichedPayload = await enrichWithMatchingThemes(config, payload);

      return {
        catalog: parseAdminTherapyCatalogContract(enrichedPayload),
        status: "success",
      };
    } catch (error) {
      return {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o catálogo agora.",
        status: "error",
      };
    }
  },
);

async function callAdminTherapyCatalogEdge<T>(
  supabaseUrl: string,
  accessToken: string,
  body: { action: "list" },
) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/admin-therapy-catalog-command`,
    {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as EdgeEnvelope<T>;

  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload && !payload.ok
        ? (payload.error?.message ?? "Falha ao carregar catálogo.")
        : "Falha ao carregar catálogo.",
    );
  }

  return payload.data;
}

type MatchingThemeRow = {
  theme_id: string;
  theme_name: string;
  theme_slug: string;
  theme_sort_order: number;
};

type TherapyThemeRow = {
  sort_order: number;
  theme_id: string;
  therapy_id: string;
};

async function enrichWithMatchingThemes(
  config: { apiKey: string; url: string },
  payload: unknown,
) {
  if (!isRecord(payload)) return payload;

  try {
    const [matchingConfigRows, therapyThemeRows] = await Promise.all([
      fetchRestRows<MatchingThemeRow>(
        config,
        "public_matching_config?select=theme_id,theme_name,theme_slug,theme_sort_order&order=theme_sort_order.asc",
      ),
      fetchRestRows<TherapyThemeRow>(
        config,
        "public_matching_therapy_themes_v?select=therapy_id,theme_id,sort_order&order=sort_order.asc",
      ),
    ]);
    const themesById = new Map<string, MatchingThemeRow>();
    const themeIdsByTherapyId = new Map<string, string[]>();

    for (const row of matchingConfigRows) {
      themesById.set(row.theme_id, row);
    }

    for (const row of therapyThemeRows) {
      themeIdsByTherapyId.set(row.therapy_id, [
        ...(themeIdsByTherapyId.get(row.therapy_id) ?? []),
        row.theme_id,
      ]);
    }

    return {
      ...payload,
      items: Array.isArray(payload.items)
        ? payload.items.map((item) =>
            isRecord(item)
              ? {
                  ...item,
                  matchingThemeIds: themeIdsByTherapyId.get(String(item.id)) ?? [],
                }
              : item,
          )
        : payload.items,
      matchingThemes: Array.from(themesById.values())
        .map((theme) => ({
          id: theme.theme_id,
          name: theme.theme_name,
          slug: theme.theme_slug,
          sortOrder: theme.theme_sort_order,
        }))
        .sort((first, second) => first.sortOrder - second.sortOrder),
    };
  } catch {
    return {
      ...payload,
      matchingThemes: [],
    };
  }
}

async function fetchRestRows<T>(
  config: { apiKey: string; url: string },
  query: string,
) {
  const response = await fetch(`${config.url}/rest/v1/${query}`, {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
    next: { revalidate: 300, tags: ["admin-matching"] },
  });

  if (!response.ok) throw new Error("Admin matching REST fetch failed.");
  return (await response.json()) as T[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
