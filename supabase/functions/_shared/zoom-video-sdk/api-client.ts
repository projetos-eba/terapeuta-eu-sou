import { createVideoSdkApiJwt } from "./api-jwt.ts";
import type { ZoomVideoSdkConfig } from "./config.ts";
import { sanitizeProviderMessage, ZoomVideoSdkError } from "./errors.ts";

export type ZoomVideoSdkApiClientOptions = {
  config: ZoomVideoSdkConfig;
  fetchImpl?: typeof fetch;
};

export class ZoomVideoSdkApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ZoomVideoSdkApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  listSessions() {
    return this.request("/videosdk/sessions");
  }

  getSession(sessionId: string) {
    return this.request(`/videosdk/sessions/${encodeURIComponent(sessionId)}`);
  }

  getSessionUsers(sessionId: string) {
    return this.request(
      `/videosdk/sessions/${encodeURIComponent(sessionId)}/users`,
    );
  }

  getSessionUserQos(sessionId: string, userId: string) {
    return this.request(
      `/videosdk/sessions/${encodeURIComponent(sessionId)}/users/${encodeURIComponent(userId)}/qos`,
    );
  }

  endSession(sessionId: string) {
    return this.request(`/videosdk/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  }

  private async request(
    path: string,
    options: { method?: "DELETE" | "GET" } = {},
    attempt = 0,
  ): Promise<unknown> {
    if (!this.options.config.allowRealZoom && !this.options.fetchImpl) {
      throw new ZoomVideoSdkError(
        "real_zoom_disabled",
        403,
        "Chamadas reais ao Zoom estao desabilitadas.",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const token = await createVideoSdkApiJwt(this.options.config);
      const response = await this.fetchImpl(`https://api.zoom.us/v2${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        method: options.method ?? "GET",
        signal: controller.signal,
      });

      if (response.status === 204) return null;
      const text = await response.text();
      const body = text ? JSON.parse(text) : null;

      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await delay(getBackoffMs(attempt, retryAfter));
        return this.request(path, options, attempt + 1);
      }

      if (!response.ok) {
        throw new ZoomVideoSdkError(
          `zoom_video_api_http_${response.status}`,
          response.status,
          sanitizeProviderMessage(body?.message ?? "Zoom Video SDK API error"),
        );
      }

      return body;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function getBackoffMs(attempt: number, retryAfter: number) {
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 10_000);
  }

  return 300 * 2 ** attempt + Math.floor(Math.random() * 150);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
