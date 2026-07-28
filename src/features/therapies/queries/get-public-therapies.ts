import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import {
  normalizeSearch,
  parseTherapySearchParams,
} from "../schemas/therapy-search-params";
import type {
  PublicTherapiesResult,
  PublicTherapyCategory,
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
    categories: [],
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
      "Supabase publico nao configurado para consultar o catalogo.",
    );
  }

  try {
    const [list, categoryRows] = await Promise.all([
      fetchRows<PublicTherapyRow>(buildListPath(params), {
        headers: {
          Range: `${(params.page - 1) * params.pageSize}-${
            params.page * params.pageSize - 1
          }`,
        },
      }),
      fetchRows<PublicTherapyRow>(
        "public_therapies_v?select=category_slug,category_name,category_sort_order&order=category_sort_order.asc,category_name.asc",
      ),
    ]);

    const totalCount = list.count ?? list.rows.length;
    const totalPages = Math.max(Math.ceil(totalCount / params.pageSize), 1);

    return {
      categories: mapCategories(categoryRows.rows),
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
      "Nao foi possivel consultar public_therapies_v.",
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
      "category_slug",
      "category_name",
      "category_sort_order",
      "therapist_count",
      "is_popular",
      "is_new",
      "published_at",
      "popularity_score",
    ].join(","),
  );

  if (params.category) {
    query.set("category_slug", `eq.${params.category}`);
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
    category: {
      name: row.category_name,
      slug: row.category_slug,
    },
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

function mapCategories(rows: PublicTherapyRow[]): PublicTherapyCategory[] {
  const categories = new Map<string, PublicTherapyCategory>();

  rows.forEach((row) => {
    const current = categories.get(row.category_slug);
    categories.set(row.category_slug, {
      count: (current?.count ?? 0) + 1,
      name: row.category_name,
      slug: row.category_slug,
    });
  });

  return Array.from(categories.values());
}
