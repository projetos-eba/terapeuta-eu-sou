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
    readonly code?: string,
    message?: string,
    readonly requestId?: string,
  ) {
    super(message ?? `Supabase Edge Function ${functionName} failed.`);
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

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!response.ok) {
    const failure = parseSupabaseFunctionFailure(text);

    throw new SupabaseFunctionError(
      functionName,
      response.status,
      failure.code,
      failure.message,
      failure.requestId,
    );
  }

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function parseSupabaseFunctionFailure(text: string) {
  if (!text) return {};

  try {
    const payload = JSON.parse(text) as {
      error?: {
        code?: unknown;
        message?: unknown;
        requestId?: unknown;
      };
    };

    return {
      code:
        typeof payload.error?.code === "string"
          ? payload.error.code
          : undefined,
      message:
        typeof payload.error?.message === "string"
          ? payload.error.message
          : undefined,
      requestId:
        typeof payload.error?.requestId === "string"
          ? payload.error.requestId
          : undefined,
    };
  } catch {
    return {};
  }
}
