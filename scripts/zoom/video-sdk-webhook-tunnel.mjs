import ngrok from "@ngrok/ngrok";

import { loadZoomVideoSdkEnv } from "./video-sdk-env-loader.mjs";
import {
  assertStaticRealZoomGates,
  printGateFailure,
  signZoomWebhookBody,
} from "./video-sdk-real-helpers.mjs";
import { recordTunnelState, realStatePath } from "./video-sdk-real-state.mjs";

loadZoomVideoSdkEnv();

const failures = assertStaticRealZoomGates({ requireNgrok: true });
if (failures.length > 0) {
  printGateFailure(failures, "npm run zoom:video-sdk:webhook:tunnel");
  process.exit(1);
}

const localBaseUrl =
  process.env.SUPABASE_LOCAL_API_URL ?? "http://127.0.0.1:54321";
const localWebhookUrl = `${localBaseUrl}/functions/v1/zoom-webhook`;
await assertLocalWebhook(localWebhookUrl);

const listener = await ngrok.forward({
  addr: localBaseUrl,
  authtoken: process.env.NGROK_AUTHTOKEN,
});
const publicBaseUrl = listener.url();
const publicWebhookUrl = `${publicBaseUrl}/functions/v1/zoom-webhook`;
await recordTunnelState({ localBaseUrl, publicBaseUrl, publicWebhookUrl });

console.log(
  JSON.stringify(
    {
      manualStep:
        "Configure esta URL no Zoom Build Platform e valide antes de qualquer teste real.",
      publicWebhookUrl,
      stateFile: realStatePath,
      requiredEvents: [
        "session.started",
        "session.ended",
        "session.user_joined",
        "session.user_left",
      ],
      stop: "Pressione Ctrl+C para encerrar o tunel.",
    },
    null,
    2,
  ),
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await closeTunnel(listener);
    process.exit(0);
  });
}

process.stdin.resume();

async function assertLocalWebhook(url) {
  const body = JSON.stringify({
    event: "endpoint.url_validation",
    event_ts: Date.now(),
    payload: { plainToken: "local-tunnel-check-token" },
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

  if (!response.ok) {
    console.error(
      JSON.stringify(
        {
          blocked: true,
          localWebhookReachable: false,
          status: response.status,
          url,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  const payload = await response.json().catch(() => null);
  const validationShape =
    typeof payload?.plainToken === "string" &&
    typeof payload?.encryptedToken === "string";
  if (!validationShape) {
    console.error(
      JSON.stringify(
        {
          blocked: true,
          localWebhookReachable: true,
          status: response.status,
          url,
          validationShape,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

async function closeTunnel(listenerToClose) {
  try {
    if (typeof listenerToClose.close === "function") {
      await listenerToClose.close();
      return;
    }
    if (typeof listenerToClose.disconnect === "function") {
      await listenerToClose.disconnect();
      return;
    }
    if (typeof ngrok.disconnect === "function") {
      await ngrok.disconnect();
      return;
    }
    if (typeof ngrok.kill === "function") {
      await ngrok.kill();
    }
  } catch {
    // ngrok closes the process-owned tunnel on process exit.
  }
}
