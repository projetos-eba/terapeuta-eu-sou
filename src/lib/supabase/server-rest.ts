import "server-only";

export type SupabaseServerRestConfig = {
  anonKey: string;
  serviceRoleKey: string;
  url: string;
};

export class SupabaseServerRestError extends Error {
  constructor(readonly status?: number) {
    super("Supabase server REST request failed.");
  }
}

export function getSupabaseServerRestConfig(): SupabaseServerRestConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) return null;

  return { anonKey, serviceRoleKey, url: url.replace(/\/$/, "") };
}

export async function supabaseServerRestRequest<T>(
  config: SupabaseServerRestConfig,
  path: string,
): Promise<T> {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
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
