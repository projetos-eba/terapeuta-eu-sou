import crypto from "node:crypto";
import { loadZoomEnv, sanitizeError, zoomEnvStatus } from "./env-loader.mjs";

loadZoomEnv();

const report = [];
const correlationId = crypto.randomUUID().slice(0, 8);
let accessToken = null;
let meetingId = null;
let resolvedHostUserId = null;

class ZoomApiError extends Error {
  constructor(operation, httpStatus, body) {
    const zoomErrorCode = body?.code ?? null;
    const zoomErrorMessage = sanitizeError(body?.message ?? "Zoom API error");
    super(`zoom_http_${httpStatus}`);
    this.operation = operation;
    this.httpStatus = httpStatus;
    this.zoomErrorCode = zoomErrorCode;
    this.zoomErrorMessage = zoomErrorMessage;
  }
}

if (process.env.ALLOW_REAL_ZOOM_TESTS !== "true") {
  console.log(
    JSON.stringify(
      {
        skipped: true,
        reason: "ALLOW_REAL_ZOOM_TESTS diferente de true",
        status: zoomEnvStatus(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

try {
  const oauth = await measure("oauth", requestToken);
  accessToken = oauth.body.access_token;
  report.push({
    operation: "validate-oauth-scope",
    requiredScope: "user:read:zak:admin",
    status: hasScope(oauth.body.scope, "user:read:zak:admin")
      ? "sucesso"
      : "falha",
  });

  const user = await measure("get-user", () =>
    zoomFetch(
      `/users/${encodeURIComponent(process.env.ZOOM_DEFAULT_HOST_USER_ID)}`,
    ),
  );
  resolvedHostUserId = user.body?.id
    ? String(user.body.id)
    : process.env.ZOOM_DEFAULT_HOST_USER_ID;
  report.push({
    active: user.body?.status === "active",
    hostIdentifierResolved: Boolean(user.body?.id),
    licensed: typeof user.body?.type === "number" ? user.body.type === 2 : null,
    operation: "validate-host",
    status: user.body?.id ? "sucesso" : "falha",
    type: typeof user.body?.type === "number" ? user.body.type : null,
  });

  const created = await measure("create-meeting", () =>
    zoomFetch(`/users/${encodeURIComponent(resolvedHostUserId)}/meetings`, {
      body: JSON.stringify({
        duration: 20,
        password: randomPasscode(),
        settings: {
          approval_type: 2,
          audio: "both",
          auto_recording: "none",
          join_before_host: false,
          mute_upon_entry: true,
          participant_video: true,
          waiting_room: true,
        },
        start_time: new Date(Date.now() + 60 * 60_000).toISOString(),
        timezone: "America/Sao_Paulo",
        topic: `[TES DEV TEST] ${correlationId}`,
        type: 2,
      }),
      method: "POST",
    }),
  );
  meetingId = String(created.body?.id ?? "");

  await measure("get-meeting", () => zoomFetch(`/meetings/${meetingId}`));

  const updatedStart = new Date(Date.now() + 90 * 60_000).toISOString();
  await measure("patch-meeting", () =>
    zoomFetch(`/meetings/${meetingId}`, {
      body: JSON.stringify({
        duration: 25,
        start_time: updatedStart,
        timezone: "America/Sao_Paulo",
        topic: `[TES DEV TEST] ${correlationId} updated`,
      }),
      method: "PATCH",
    }),
  );

  const updated = await measure("get-meeting-after-update", () =>
    zoomFetch(`/meetings/${meetingId}`),
  );
  report.push({
    durationMatches: updated.body?.duration === 25,
    operation: "validate-meeting-update",
    status:
      updated.body?.duration === 25 &&
      String(updated.body?.topic ?? "").includes(correlationId)
        ? "sucesso"
        : "falha",
  });

  const zakResult = await measure(
    "get-zak",
    async () => {
      const result = await zoomFetch(
        `/users/${encodeURIComponent(resolvedHostUserId)}/token?type=zak`,
      );

      return {
        body: { tokenPresent: Boolean(result.body?.token) },
        httpStatus: result.httpStatus,
      };
    },
    { continueOnFailure: true },
  );
  report.push({
    classification: classifyZakResult({
      error: zakResult?.error,
      host: user.body,
      scopePresent: hasScope(oauth.body.scope, "user:read:zak:admin"),
      tokenPresent: zakResult?.body?.tokenPresent,
    }),
    operation: "identify-zak-failure",
    status: zakResult?.body?.tokenPresent ? "sucesso" : "falha",
  });

  await measure(
    "get-me-zak-diagnostic",
    async () => {
      const result = await zoomFetch("/users/me/zak");

      return {
        body: {
          tokenPresent: Boolean(result.body?.token ?? result.body?.zak),
        },
        httpStatus: result.httpStatus,
      };
    },
    { continueOnFailure: true },
  );

  await measure("meeting-sdk-jwt-role-0", () =>
    createAndValidateMeetingSdkJwt({ meetingNumber: meetingId, role: 0 }),
  );
  await measure("meeting-sdk-jwt-role-1", () =>
    createAndValidateMeetingSdkJwt({ meetingNumber: meetingId, role: 1 }),
  );
} catch (error) {
  report.push({
    cleanup: meetingId ? "pendente" : "nao_aplicavel",
    error: sanitizeError(error),
    operation: "real-test",
    status: "falha",
  });
} finally {
  if (meetingId) {
    await cleanupMeeting(meetingId);
  }

  console.log(JSON.stringify(report, null, 2));
}

async function requestToken() {
  const url = new URL("https://zoom.us/oauth/token");
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", process.env.ZOOM_ACCOUNT_ID);
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.ZOOM_S2S_CLIENT_ID}:${process.env.ZOOM_S2S_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    method: "POST",
  });
  const body = await parseZoomBody(response);
  if (!response.ok || !body.access_token) {
    throw new ZoomApiError("oauth", response.status, body);
  }

  return {
    body: {
      access_token: body.access_token,
      expires_in: body.expires_in,
      scope: body.scope,
      token_type: body.token_type,
    },
    httpStatus: response.status,
  };
}

async function zoomFetch(path, options = {}) {
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = response.status === 204 ? null : await parseZoomBody(response);
  if (!response.ok) throw new ZoomApiError(path, response.status, body);

  return { body, httpStatus: response.status };
}

async function measure(operation, action, options = {}) {
  const started = Date.now();
  try {
    const result = await action();
    report.push({
      durationMs: Date.now() - started,
      httpStatus: result?.httpStatus ?? null,
      operation,
      status: "sucesso",
    });
    return result;
  } catch (error) {
    const details = safeErrorDetails(error);
    report.push({
      durationMs: Date.now() - started,
      ...details,
      operation,
      status: "falha",
    });
    if (options.continueOnFailure) return { error: details };

    throw error;
  }
}

async function cleanupMeeting(id) {
  try {
    await measure("delete-meeting", () =>
      zoomFetch(`/meetings/${id}`, { method: "DELETE" }),
    );
    await measure("confirm-delete", async () => {
      try {
        await zoomFetch(`/meetings/${id}`);
      } catch (error) {
        if (error instanceof ZoomApiError && error.httpStatus === 404) {
          return { httpStatus: 404 };
        }
        throw error;
      }
      throw new Error("zoom_cleanup_not_confirmed");
    });
    report.push({ cleanup: "sim", operation: "cleanup", status: "sucesso" });
  } catch (error) {
    report.push({
      cleanup: "nao",
      error: sanitizeError(error),
      operation: "cleanup",
      status: "falha",
    });
  }
}

async function createAndValidateMeetingSdkJwt({ meetingNumber, role }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    appKey: process.env.ZOOM_MEETING_SDK_CLIENT_ID,
    exp: now + 60 * 60 * 2,
    iat: now - 30,
    mn: meetingNumber,
    role,
    sdkKey: process.env.ZOOM_MEETING_SDK_CLIENT_ID,
    tokenExp: now + 60 * 60 * 2,
  };
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${header}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", process.env.ZOOM_MEETING_SDK_CLIENT_SECRET)
    .update(signingInput)
    .digest("base64url");
  const jwt = `${signingInput}.${signature}`;
  const decoded = JSON.parse(
    Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"),
  );

  if (
    jwt.split(".").length !== 3 ||
    decoded.role !== role ||
    decoded.mn !== meetingNumber ||
    decoded.exp <= decoded.iat
  ) {
    throw new Error("invalid_meeting_sdk_jwt");
  }

  return { body: { claimsValid: true }, httpStatus: null };
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function randomPasscode() {
  return crypto.randomBytes(8).toString("base64url").slice(0, 10);
}

async function parseZoomBody(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function hasScope(scopeText, requiredScope) {
  return String(scopeText ?? "")
    .split(/\s+/)
    .includes(requiredScope);
}

function safeErrorDetails(error) {
  if (error instanceof ZoomApiError) {
    return {
      classification: classifyZoomApiError(error),
      error: sanitizeError(error),
      httpStatus: error.httpStatus,
      zoomErrorCode: error.zoomErrorCode,
      zoomErrorMessage: sanitizeError(error.zoomErrorMessage),
    };
  }

  return {
    classification: "unknown",
    error: sanitizeError(error),
    httpStatus: null,
    zoomErrorCode: null,
    zoomErrorMessage: sanitizeError(error),
  };
}

function classifyZakResult({ error, host, scopePresent, tokenPresent }) {
  if (tokenPresent) return "zak_obtained";
  if (!scopePresent) return "missing_scope_user_read_zak_admin";
  if (error?.classification === "scope") return "scope";
  if (!host?.id) return "host_identifier_invalid_or_outside_account";
  if (host.status && host.status !== "active") return "host_not_active";
  if (typeof host.type === "number" && host.type !== 2) {
    return "host_not_licensed_type_2";
  }
  if (error?.httpStatus === 401 || error?.httpStatus === 403) {
    return "general_app_authorization_or_marketplace_restriction";
  }
  if (error?.httpStatus === 404)
    return "host_identifier_invalid_or_outside_account";

  return "zoom_marketplace_or_account_restriction_unconfirmed";
}

function classifyZoomApiError(error) {
  const message =
    `${error.zoomErrorCode ?? ""} ${error.zoomErrorMessage ?? ""}`.toLowerCase();
  if (message.includes("scope")) return "scope";
  if (error.httpStatus === 401 || error.httpStatus === 403) {
    return "authorization_or_marketplace";
  }
  if (error.httpStatus === 404) return "identifier_or_missing_resource";
  if (error.httpStatus === 429) return "rate_limit";
  if (error.httpStatus >= 500) return "provider_transient";

  return "provider_error";
}
