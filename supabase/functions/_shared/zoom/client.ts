import { getZoomAccessToken } from "./oauth.ts";
import { clearZoomTokenCache } from "./token-cache.ts";
import { ZoomError, sanitizeProviderMessage } from "./errors.ts";
import type { ZoomConfig } from "./types.ts";

export type ZoomRequestOptions = {
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  timeoutMs?: number;
};

export class ZoomRestClient {
  constructor(private readonly config: ZoomConfig) {}

  async request<T>(path: string, options: ZoomRequestOptions = {}): Promise<T> {
    return this.requestWithToken<T>(path, options, false);
  }

  private async requestWithToken<T>(
    path: string,
    options: ZoomRequestOptions,
    refreshed: boolean,
  ): Promise<T> {
    const token = await getZoomAccessToken(this.config);
    const url = `${token.apiBaseUrl.replace(/\/+$/g, "")}/v2${path}`;
    const response = await fetchWithTimeout(url, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      method: options.method ?? "GET",
      timeoutMs: options.timeoutMs ?? 12_000,
    });

    if (response.status === 401 && !refreshed) {
      clearZoomTokenCache();
      return this.requestWithToken(path, options, true);
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      throw new ZoomError(
        `zoom_http_${response.status}`,
        response.status,
        sanitizeProviderMessage(text),
        retryAfter ? Number(retryAfter) : undefined,
      );
    }

    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs: number },
) {
  let attempt = 0;
  let delayMs = 300;

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (
        ![429, 500, 502, 503, 504].includes(response.status) ||
        attempt >= 2
      ) {
        return response;
      }

      const retryHeader = response.headers.get("retry-after");
      const retryAfterMs = retryHeader ? Number(retryHeader) * 1000 : delayMs;
      await sleep(Number.isFinite(retryAfterMs) ? retryAfterMs : delayMs);
      delayMs *= 2;
      attempt += 1;
    } catch (error) {
      if (attempt >= 2) {
        throw new ZoomError(
          "zoom_network_error",
          503,
          sanitizeProviderMessage(error),
        );
      }

      await sleep(delayMs);
      delayMs *= 2;
      attempt += 1;
    } finally {
      clearTimeout(timer);
    }
  }
}

function sleep(ms: number) {
  const jitter = crypto.getRandomValues(new Uint8Array(1))[0] % 80;

  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}
