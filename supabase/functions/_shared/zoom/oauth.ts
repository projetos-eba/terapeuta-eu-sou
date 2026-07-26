import { DomainError } from "../payments/http.ts";
import { basicAuth } from "./crypto.ts";
import { ZoomError, sanitizeProviderMessage } from "./errors.ts";
import { withZoomTokenCache } from "./token-cache.ts";
import type { ZoomAccessToken, ZoomConfig } from "./types.ts";

type TokenResponse = {
  access_token?: string;
  api_url?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export function getZoomAccessToken(config: ZoomConfig) {
  return withZoomTokenCache(() => requestZoomAccessToken(config));
}

export function createZoomBasicAuthHeader(
  clientId: string,
  clientSecret: string,
) {
  return basicAuth(clientId, clientSecret);
}

async function requestZoomAccessToken(
  config: ZoomConfig,
): Promise<ZoomAccessToken> {
  const url = new URL("https://zoom.us/oauth/token");
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", config.accountId);

  const response = await fetch(url, {
    headers: {
      Authorization: createZoomBasicAuthHeader(
        config.s2sClientId,
        config.s2sClientSecret,
      ),
    },
    method: "POST",
  });
  const text = await response.text();

  if (!response.ok) {
    throw new ZoomError(
      "zoom_oauth_failed",
      response.status,
      sanitizeProviderMessage(text),
      retryAfter(response),
    );
  }

  const body = JSON.parse(text) as TokenResponse;

  if (!body.access_token || body.token_type?.toLowerCase() !== "bearer") {
    throw new DomainError(
      "zoom_oauth_invalid_response",
      503,
      "Resposta Zoom invalida.",
    );
  }

  return {
    accessToken: body.access_token,
    apiBaseUrl: body.api_url ?? config.apiBaseUrl,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
    scope: body.scope ?? "",
  };
}

function retryAfter(response: Response) {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;

  return Number.isFinite(seconds) ? seconds : undefined;
}
