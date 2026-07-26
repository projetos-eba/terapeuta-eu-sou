import type { ZoomAccessToken } from "./types.ts";

let cachedToken: ZoomAccessToken | null = null;
let pendingToken: Promise<ZoomAccessToken> | null = null;

export function getCachedZoomToken() {
  if (!cachedToken) return null;

  return cachedToken.expiresAt > Date.now() + 60_000 ? cachedToken : null;
}

export async function withZoomTokenCache(
  loader: () => Promise<ZoomAccessToken>,
) {
  const cached = getCachedZoomToken();
  if (cached) return cached;

  if (!pendingToken) {
    pendingToken = loader()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        pendingToken = null;
      });
  }

  return pendingToken;
}

export function clearZoomTokenCache() {
  cachedToken = null;
}
