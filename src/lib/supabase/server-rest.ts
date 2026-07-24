import "server-only";

import { getSupabasePublicConfig } from "./public-config";

export type SupabaseServerRestConfig = {
  accessToken: string;
  apiKey: string;
  url: string;
};

export class SupabaseServerRestError extends Error {
  constructor(readonly status?: number) {
    super("Supabase server REST request failed.");
  }
}

export function getSupabaseServerRestConfig(
  accessToken: string | null,
): SupabaseServerRestConfig | null {
  const config = getSupabasePublicConfig();

  if (!config || !accessToken) return null;

  return {
    accessToken,
    apiKey: config.apiKey,
    url: config.url,
  };
}

export async function supabaseServerRestRequest<T>(
  config: SupabaseServerRestConfig,
  path: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new SupabaseServerRestError(response.status);
  }

  return (await response.json()) as T;
}

export async function getRowsByIds<T>(
  config: SupabaseServerRestConfig,
  table: string,
  select: string,
  ids: string[],
): Promise<T[]> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);

  if (uniqueIds.length === 0) return [];

  return supabaseServerRestRequest<T[]>(
    config,
    `/rest/v1/${table}?select=${select}&id=in.(${uniqueIds.join(",")})`,
  );
}
