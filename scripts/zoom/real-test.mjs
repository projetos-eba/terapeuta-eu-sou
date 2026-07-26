import crypto from "node:crypto";
import { loadZoomEnv, sanitizeError, zoomEnvStatus } from "./env-loader.mjs";

loadZoomEnv();

const report = [];
const correlationId = crypto.randomUUID().slice(0, 8);
let accessToken = null;
let meetingId = null;

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
  accessToken = (await measure("oauth", requestToken)).body.access_token;

  const user = await measure("get-user", () =>
    zoomFetch(
      `/users/${encodeURIComponent(process.env.ZOOM_DEFAULT_HOST_USER_ID)}`,
    ),
  );
  report.push({
    active: user.body?.status === "active",
    licensed: typeof user.body?.type === "number" ? user.body.type > 1 : null,
    operation: "validate-host",
    status: user.body?.id ? "sucesso" : "falha",
  });

  const created = await measure("create-meeting", () =>
    zoomFetch(
      `/users/${encodeURIComponent(process.env.ZOOM_DEFAULT_HOST_USER_ID)}/meetings`,
      {
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
      },
    ),
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

  await measure("get-zak", () =>
    zoomFetch(
      `/users/${encodeURIComponent(process.env.ZOOM_DEFAULT_HOST_USER_ID)}/token?type=zak`,
    ),
  ).catch(() => null);

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
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`oauth_http_${response.status}`);
  }

  return {
    body: {
      access_token: body.access_token,
      expires_in: body.expires_in,
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
  const body =
    response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`zoom_http_${response.status}`);

  return { body, httpStatus: response.status };
}

async function measure(operation, action) {
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
    report.push({
      durationMs: Date.now() - started,
      error: sanitizeError(error),
      operation,
      status: "falha",
    });
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
        if (sanitizeError(error).includes("zoom_http_404")) {
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
