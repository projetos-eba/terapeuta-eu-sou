import crypto from "node:crypto";

export const zoomApiBaseUrl = "https://api.zoom.us/v2";

export function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    return { error: `${name} ausente`, value: null };
  }

  return { error: null, value };
}

export function maskIdentifier(value) {
  if (!value) return null;
  const hash = crypto.createHash("sha256").update(value).digest("hex");
  return `sha256:${hash.slice(0, 16)}`;
}

export function createApiJwt() {
  const apiKey = getRequiredEnv("ZOOM_VIDEO_SDK_API_KEY");
  const apiSecret = getRequiredEnv("ZOOM_VIDEO_SDK_API_SECRET");
  if (apiKey.error || apiSecret.error) {
    throw new Error(apiKey.error ?? apiSecret.error);
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 3600;

  return signJwt(
    {
      exp,
      iat,
      iss: apiKey.value,
    },
    apiSecret.value,
  );
}

export async function zoomApi(path, options = {}) {
  const token = createApiJwt();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${zoomApiBaseUrl}${path}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      method: options.method ?? "GET",
      signal: controller.signal,
    });
    const text = await response.text();
    const body = parseJsonOrText(text);

    return {
      body,
      ok: response.ok,
      retryAfter: response.headers.get("retry-after"),
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listActiveSessions({ sessionName } = {}) {
  const params = new URLSearchParams({
    from: zoomDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    page_size: "300",
    to: zoomDate(new Date()),
    type: "live",
  });
  if (sessionName) params.set("session_name", sessionName);

  const response = await zoomApi(`/videosdk/sessions?${params.toString()}`);
  if (!response.ok) return response;

  const sessions = Array.isArray(response.body?.sessions)
    ? response.body.sessions
    : [];

  return {
    ...response,
    activeSessions: sessions.filter(
      (session) =>
        !["ended", "canceled", "cancelled", "failed"].includes(
          String(session.status ?? "").toLowerCase(),
        ),
    ),
  };
}

export async function endSessionByApi(sessionId) {
  return zoomApi(`/videosdk/sessions/${encodeURIComponent(sessionId)}/status`, {
    body: { action: "end" },
    method: "PUT",
  });
}

export function assertStaticRealZoomGates({ requireNgrok = false } = {}) {
  const failures = [];
  const required = [
    "ZOOM_VIDEO_SDK_KEY",
    "ZOOM_VIDEO_SDK_SECRET",
    "ZOOM_VIDEO_SDK_API_KEY",
    "ZOOM_VIDEO_SDK_API_SECRET",
    "ZOOM_WEBHOOK_SECRET_TOKEN",
  ];

  if (process.env.ALLOW_REAL_ZOOM !== "true") {
    failures.push({
      expected: "true",
      item: "ALLOW_REAL_ZOOM",
      where: "supabase/functions/.env",
    });
  }

  if (process.env.ZOOM_ENVIRONMENT !== "development") {
    failures.push({
      expected: "development",
      item: "ZOOM_ENVIRONMENT",
      where: "supabase/functions/.env",
    });
  }

  for (const name of required) {
    if (!process.env[name]?.trim()) {
      failures.push({
        expected: "valor secreto nao vazio",
        item: name,
        where: "supabase/functions/.env",
      });
    }
  }

  if (requireNgrok && !process.env.NGROK_AUTHTOKEN?.trim()) {
    failures.push({
      expected: "authtoken ngrok",
      item: "NGROK_AUTHTOKEN",
      where: "supabase/functions/.env",
    });
  }

  return failures;
}

export function printGateFailure(failures, nextCommand) {
  console.error(
    JSON.stringify(
      {
        blocked: true,
        failures,
        nextCommand,
      },
      null,
      2,
    ),
  );
}

export function signZoomWebhookBody({ body, secret, timestamp }) {
  return `v0=${crypto
    .createHmac("sha256", secret)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;
}

function signJwt(claims, secret) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const signature = base64url(
    crypto.createHmac("sha256", secret).update(signingInput).digest(),
  );

  return `${signingInput}.${signature}`;
}

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseJsonOrText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function zoomDate(date) {
  return date.toISOString().slice(0, 10);
}
