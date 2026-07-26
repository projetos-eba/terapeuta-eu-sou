import crypto from "node:crypto";
import { loadZoomVideoSdkEnv } from "./video-sdk-env-loader.mjs";

loadZoomVideoSdkEnv();

const url =
  process.env.ZOOM_LOCAL_WEBHOOK_URL ??
  "http://127.0.0.1:54321/functions/v1/zoom-webhook";
const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

if (!secret) {
  console.error(JSON.stringify({ error: "ZOOM_WEBHOOK_SECRET_TOKEN ausente" }));
  process.exit(1);
}

const events = [
  {
    event: "endpoint.url_validation",
    payload: { plainToken: "local-validation-token" },
  },
  sessionEvent("session.started"),
  sessionEvent("session.user_joined", {
    participant: {
      id: "provider-user-1",
      user_key: "tes-v1-p-123456789012345678901234",
    },
  }),
  sessionEvent("session.user_left", {
    participant: {
      duration: 60,
      id: "provider-user-1",
      user_key: "tes-v1-p-123456789012345678901234",
    },
  }),
  sessionEvent("session.ended"),
  sessionEvent("session.unknown"),
];

const results = [];
for (const event of events) {
  const body = JSON.stringify({
    event_ts: Math.floor(Date.now() / 1000),
    ...event,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${crypto
    .createHmac("sha256", secret)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;
  const response = await fetch(url, {
    body,
    headers: {
      "content-type": "application/json",
      "x-zm-request-timestamp": timestamp,
      "x-zm-signature": signature,
    },
    method: "POST",
  });

  results.push({
    event: event.event,
    ok: response.ok,
    status: response.status,
  });
}

console.log(JSON.stringify({ results }, null, 2));

function sessionEvent(event, extraObject = {}) {
  return {
    event,
    payload: {
      account_id: "mock-account",
      object: {
        id: "mock-provider-session",
        session_name: "tesvs-local-smoke-session",
        ...extraObject,
      },
    },
  };
}
