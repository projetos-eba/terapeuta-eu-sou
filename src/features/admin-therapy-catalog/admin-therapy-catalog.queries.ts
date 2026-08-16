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
        message: "Não foi possível carregar o catálogo agora.",
        status: "error",
      };
    }

    try {
      const payload = await callAdminTherapyCatalogEdge<unknown>(
        config.url,
        accessToken,
        { action: "list" },
      );
      const enrichedPayload = await enrichWithMatchingThemes(
        config,
        accessToken,
        payload,
      );

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
  body: { action: "list" } | { action: "matchingList" },
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
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  slug: string;
  sortOrder: number;
};

type TherapyThemeRow = {
  sort_order: number;
  theme_id: string;
  therapy_id: string;
};

async function enrichWithMatchingThemes(
  config: { apiKey: string; url: string },
  accessToken: string,
  payload: unknown,
) {
  if (!isRecord(payload)) return payload;

  try {
    const matchingPayload = await callAdminTherapyCatalogEdge<unknown>(
      config.url,
      accessToken,
      {
        action: "matchingList",
      },
    );
    const themes = parseAdminMatchingThemes(matchingPayload);
    const therapyThemeRows = await fetchAdminRestRows<TherapyThemeRow>(
      config,
      accessToken,
      "public_matching_therapy_themes_v?select=therapy_id,theme_id,sort_order&order=sort_order.asc",
    ).catch(() => []);
    const themeIdsByTherapyId = new Map<string, string[]>();

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
                  matchingThemeIds:
                    themeIdsByTherapyId.get(String(item.id)) ?? [],
                }
              : item,
          )
        : payload.items,
      matchingThemes: themes
        .filter((theme) => theme.isActive)
        .map((theme) => ({
          id: theme.id,
          imageUrl: theme.imageUrl,
          name: theme.name,
          slug: theme.slug,
          sortOrder: theme.sortOrder,
        }))
        .sort((first, second) => first.sortOrder - second.sortOrder),
    };
  } catch {
    try {
      const therapyThemeRows = await fetchAdminRestRows<TherapyThemeRow>(
        config,
        accessToken,
        "public_matching_therapy_themes_v?select=therapy_id,theme_id,sort_order&order=sort_order.asc",
      );
      const themeIdsByTherapyId = new Map<string, string[]>();

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
                    matchingThemeIds:
                      themeIdsByTherapyId.get(String(item.id)) ?? [],
                  }
                : item,
            )
          : payload.items,
        matchingThemes: [],
      };
    } catch {
      return {
        ...payload,
        matchingThemes: [],
      };
    }
  }
}

async function fetchAdminRestRows<T>(
  config: { apiKey: string; url: string },
  accessToken: string,
  query: string,
) {
  const response = await fetch(`${config.url}/rest/v1/${query}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error("Admin matching REST fetch failed.");
  return (await response.json()) as T[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseAdminMatchingThemes(payload: unknown): MatchingThemeRow[] {
  if (!isRecord(payload) || !Array.isArray(payload.themes)) return [];

  return payload.themes
    .filter(isRecord)
    .map((theme) => ({
      id: asString(theme.id),
      imageUrl: asNullableString(theme.imageUrl),
      isActive: theme.isActive === true,
      name: asString(theme.name),
      slug: asString(theme.slug),
      sortOrder: asNumber(theme.sortOrder),
    }))
    .filter((theme) => theme.id && theme.name && theme.slug);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
