import { createVideoSdkApiJwt } from "./api-jwt.ts";
import type { ZoomVideoSdkConfig } from "./config.ts";
import { sanitizeProviderMessage, ZoomVideoSdkError } from "./errors.ts";

export type ZoomVideoSdkApiClientOptions = {
  config: ZoomVideoSdkConfig;
  fetchImpl?: typeof fetch;
};

export type ExactLiveSessionResolution =
  | { kind: "none" }
  | { kind: "one"; sessionId: string }
  | { kind: "ambiguous" };

// A missing webhook must never make maintenance guess which provider session
// to end. The session name is an opaque, booking-scoped identifier, but the
// provider response is still validated before its ID is used.
export function resolveExactLiveSessionId(
  value: unknown,
  expectedSessionName: string,
): ExactLiveSessionResolution {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ZoomVideoSdkError(
      "zoom_video_sessions_response_invalid",
      502,
      "Resposta de sessoes do Zoom invalida.",
    );
  }

  const sessions = (value as Record<string, unknown>).sessions;
  if (!Array.isArray(sessions)) {
    throw new ZoomVideoSdkError(
      "zoom_video_sessions_response_invalid",
      502,
      "Resposta de sessoes do Zoom invalida.",
    );
  }

  const matchingIds = new Set<string>();
  for (const session of sessions) {
    if (!session || typeof session !== "object" || Array.isArray(session)) {
      continue;
    }
    const item = session as Record<string, unknown>;
    if (item.session_name !== expectedSessionName) continue;
    const sessionId =
      typeof item.session_id === "string"
        ? item.session_id.trim()
        : typeof item.id === "string"
          ? item.id.trim()
          : "";
    if (sessionId) matchingIds.add(sessionId);
  }

  if (matchingIds.size === 0) return { kind: "none" };
  if (matchingIds.size !== 1) return { kind: "ambiguous" };
  return { kind: "one", sessionId: [...matchingIds][0] };
}

export class ZoomVideoSdkApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ZoomVideoSdkApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  listSessions(input: { sessionName?: string } = {}) {
    const params = new URLSearchParams({
      from: zoomDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      page_size: "300",
      to: zoomDate(new Date()),
      type: "live",
    });
    if (input.sessionName) params.set("session_name", input.sessionName);
    return this.request(`/videosdk/sessions?${params.toString()}`);
  }

  getSession(sessionId: string) {
    return this.request(`/videosdk/sessions/${encodeZoomSessionId(sessionId)}`);
  }

  getSessionUsers(sessionId: string) {
    return this.request(
      `/videosdk/sessions/${encodeZoomSessionId(sessionId)}/users`,
    );
  }

  getSessionUserQos(sessionId: string, userId: string) {
    return this.request(
      `/videosdk/sessions/${encodeZoomSessionId(sessionId)}/users/${encodeURIComponent(userId)}/qos`,
    );
  }

  endSession(sessionId: string) {
    return this.request(
      `/videosdk/sessions/${encodeZoomSessionId(sessionId)}/status`,
      {
        body: { action: "end" },
        method: "PUT",
      },
    );
  }

  private async request(
    path: string,
    options: { body?: Record<string, unknown>; method?: "GET" | "PUT" } = {},
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
        body: options.body ? JSON.stringify(options.body) : undefined,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        method: options.method ?? "GET",
        signal: controller.signal,
      });

      if (response.status === 204) return null;
      const text = await response.text();
      const body = parseJsonOrNull(text);

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

function encodeZoomSessionId(sessionId: string) {
  return encodeURIComponent(encodeURIComponent(sessionId));
}

function parseJsonOrNull(text: string) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function zoomDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
