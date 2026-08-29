import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import {
  normalizeSearch,
  parseTherapySearchParams,
} from "../schemas/therapy-search-params";
import type {
  PublicTherapiesResult,
  PublicTherapyTheme,
  PublicTherapyListItem,
  PublicTherapyRow,
  TherapySearchParams,
} from "../types";

function hasSupabaseConfig() {
  return Boolean(getSupabasePublicConfig());
}

function emptyResult(
  params: TherapySearchParams,
  source: PublicTherapiesResult["source"] = "empty",
  errorMessage?: string,
): PublicTherapiesResult {
  return {
    themes: [],
    errorMessage,
    items: [],
    page: params.page,
    pageSize: params.pageSize,
    source,
    totalCount: 0,
    totalPages: 1,
  };
}

async function fetchRows<Row>(
  path: string,
  init?: RequestInit,
): Promise<{ count: number | null; rows: Row[] }> {
  const config = getSupabasePublicConfig();

  if (!config) {
    return { count: null, rows: [] };
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      Prefer: "count=exact",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 900, tags: ["therapies"] },
  });

  if (!response.ok) {
    throw new Error("Public therapies fetch failed");
  }

  const range = response.headers.get("content-range");
  const count = range ? Number.parseInt(range.split("/")[1] ?? "", 10) : null;

  return {
    count: Number.isFinite(count) ? count : null,
    rows: (await response.json()) as Row[],
  };
}

export async function getPublicTherapies(
  params: TherapySearchParams,
): Promise<PublicTherapiesResult> {
  if (!hasSupabaseConfig()) {
    return emptyResult(
      params,
      "unconfigured",
      "Supabase público não configurado para consultar o catálogo.",
    );
  }

  try {
    const [list, themeRows] = await Promise.all([
      fetchRows<PublicTherapyRow>(buildListPath(params), {
        headers: {
          Range: `${(params.page - 1) * params.pageSize}-${
            params.page * params.pageSize - 1
          }`,
        },
      }),
      fetchRows<PublicTherapyRow>(
        "public_therapies_v?select=id,theme_names,theme_slugs",
      ),
    ]);

    const totalCount = list.count ?? list.rows.length;
    const totalPages = Math.max(Math.ceil(totalCount / params.pageSize), 1);

    return {
      themes: mapThemes(themeRows.rows),
      items: list.rows.map(mapTherapy),
      page: params.page > totalPages ? 1 : params.page,
      pageSize: params.pageSize,
      source: "supabase",
      totalCount,
      totalPages,
    };
  } catch {
    return emptyResult(
      params,
      "error",
      "Não foi possível consultar public_therapies_v.",
    );
  }
}

export async function getPublicTherapiesFromSearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const params = parseTherapySearchParams(searchParams);
  return {
    params,
    result: await getPublicTherapies(params),
  };
}

function buildListPath(params: TherapySearchParams) {
  const query = new URLSearchParams();

  query.set(
    "select",
    [
      "id",
      "slug",
      "name",
      "short_description",
      "image_url",
      "theme_names",
      "theme_slugs",
      "therapist_count",
      "is_popular",
      "is_new",
      "published_at",
      "popularity_score",
    ].join(","),
  );

  if (params.theme) {
    query.set("theme_slugs", `cs.{${params.theme}}`);
  }

  if (params.q) {
    query.set("search_text", `ilike.*${normalizeSearch(params.q)}*`);
  }

  query.set("order", getOrder(params));

  return `public_therapies_v?${query.toString()}`;
}

function getOrder(params: TherapySearchParams) {
  if (params.sort === "az") return "name.asc";
  if (params.sort === "newest") return "published_at.desc.nullslast,name.asc";
  if (params.sort === "popular") return "popularity_score.desc,name.asc";
  if (params.sort === "most_searched") return "therapist_count.desc,name.asc";
  return params.q
    ? "popularity_score.desc,therapist_count.desc,name.asc"
    : "popularity_score.desc,name.asc";
}

function mapTherapy(row: PublicTherapyRow): PublicTherapyListItem {
  return {
    id: row.id,
    imageUrl: row.image_url,
    isNew: row.is_new,
    isPopular: row.is_popular,
    name: row.name,
    shortDescription: row.short_description,
    slug: row.slug,
    therapistCount: row.therapist_count ?? 0,
  };
}

function mapThemes(rows: PublicTherapyRow[]): PublicTherapyTheme[] {
  const themes = new Map<string, PublicTherapyTheme>();

  rows.forEach((row) => {
    row.theme_slugs?.forEach((slug, index) => {
      const name = row.theme_names?.[index];
      if (!name) return;
      const current = themes.get(slug);
      themes.set(slug, {
        count: (current?.count ?? 0) + 1,
        name,
        slug,
      });
    });
  });

  return Array.from(themes.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
}
