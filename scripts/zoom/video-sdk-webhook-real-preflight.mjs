import { loadZoomVideoSdkEnv } from "./video-sdk-env-loader.mjs";
import {
  assertStaticRealZoomGates,
  printGateFailure,
  signZoomWebhookBody,
} from "./video-sdk-real-helpers.mjs";

loadZoomVideoSdkEnv();

const failures = assertStaticRealZoomGates({ requireNgrok: true });
if (failures.length > 0) {
  printGateFailure(failures, "npm run zoom:video-sdk:webhook:real-preflight");
  process.exit(1);
}

const localUrl =
  process.env.ZOOM_LOCAL_WEBHOOK_URL ??
  "http://127.0.0.1:54321/functions/v1/zoom-webhook";

try {
  const body = JSON.stringify({
    event: "endpoint.url_validation",
    event_ts: Date.now(),
    payload: { plainToken: "local-real-preflight-token" },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(localUrl, {
    body,
    headers: {
      "content-type": "application/json",
      "x-zm-request-timestamp": timestamp,
      "x-zm-signature": signZoomWebhookBody({
        body,
        secret: process.env.ZOOM_WEBHOOK_SECRET_TOKEN,
        timestamp,
      }),
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  const validationShape =
    typeof payload?.plainToken === "string" &&
    typeof payload?.encryptedToken === "string";

  console.log(
    JSON.stringify(
      {
        localWebhookReachable: response.ok && validationShape,
        status: response.status,
        url: localUrl,
        validationShape,
      },
      null,
      2,
    ),
  );
  if (!response.ok || !validationShape) process.exit(1);
} catch (error) {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : "UNKNOWN",
        localWebhookReachable: false,
        url: localUrl,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
