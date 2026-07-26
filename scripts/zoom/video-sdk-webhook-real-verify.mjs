import { loadZoomVideoSdkEnv } from "./video-sdk-env-loader.mjs";
import {
  assertStaticRealZoomGates,
  printGateFailure,
  signZoomWebhookBody,
} from "./video-sdk-real-helpers.mjs";
import {
  getCurrentWebhookUrl,
  isWebhookUrl,
  recordWebhookVerification,
  realStatePath,
} from "./video-sdk-real-state.mjs";

loadZoomVideoSdkEnv();

const failures = assertStaticRealZoomGates({ requireNgrok: false });
if (failures.length > 0) {
  printGateFailure(
    failures,
    "npm run zoom:video-sdk:webhook:real-verify -- <url>",
  );
  process.exit(1);
}

const url = await getCurrentWebhookUrl({ explicitUrl: process.argv[2] });
if (!isWebhookUrl(url)) {
  printGateFailure(
    [
      {
        expected: "https://<subdominio-ngrok>/functions/v1/zoom-webhook",
        item: "URL temporaria do ngrok",
        where:
          ".tmp/zoom-real-homologation.json, argumento ou ZOOM_PUBLIC_WEBHOOK_URL",
      },
    ],
    "npm run zoom:video-sdk:webhook:real-verify -- https://<subdominio-ngrok>/functions/v1/zoom-webhook",
  );
  process.exit(1);
}

const body = JSON.stringify({
  event: "endpoint.url_validation",
  event_ts: Date.now(),
  payload: { plainToken: "public-real-verify-token" },
});
const timestamp = String(Math.floor(Date.now() / 1000));
const response = await fetch(url, {
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
  typeof payload?.data?.plainToken === "string" &&
  typeof payload?.data?.encryptedToken === "string";

if (response.ok && validationShape) {
  await recordWebhookVerification({ publicWebhookUrl: url });
}

console.log(
  JSON.stringify(
    {
      ok: response.ok,
      stateFile: realStatePath,
      status: response.status,
      url,
      validationShape,
    },
    null,
    2,
  ),
);

if (!response.ok || !validationShape) process.exit(1);
