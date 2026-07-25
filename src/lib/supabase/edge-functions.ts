import "server-only";

import {
  getSupabasePublicConfig as getSharedSupabasePublicConfig,
  type SupabasePublicConfig as SharedSupabasePublicConfig,
} from "./public-config";

export type SupabasePublicConfig = SharedSupabasePublicConfig;

export class SupabaseFunctionError extends Error {
  constructor(
    readonly functionName: string,
    readonly status: number,
  ) {
    super(`Supabase Edge Function ${functionName} failed.`);
  }
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  return getSharedSupabasePublicConfig();
}

export async function invokeSupabaseFunction<T>(
  config: SupabasePublicConfig,
  functionName: string,
  options: {
    accessToken?: string | null;
    body?: unknown;
    method?: "GET" | "POST";
  } = {},
): Promise<T> {
  const bearerToken = options.accessToken ?? config.apiKey;
  const response = await fetch(`${config.url}/functions/v1/${functionName}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    method: options.method ?? "POST",
  });

  if (!response.ok) {
    throw new SupabaseFunctionError(functionName, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
