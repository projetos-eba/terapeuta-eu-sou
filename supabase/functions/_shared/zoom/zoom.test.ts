import {
  assert,
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { parseZoomEnvironment } from "./config.ts";
import { basicAuth } from "./crypto.ts";
import { createMeetingSdkJwt } from "./meeting-sdk-jwt.ts";
import { generateMeetingPasscode } from "./meetings.ts";
import {
  createZoomChallengeResponse,
  createZoomWebhookEventKey,
  verifyZoomWebhookSignature,
} from "./webhook.ts";
import { hmacSha256Hex } from "./crypto.ts";
import type { ZoomConfig } from "./types.ts";

Deno.test("zoom parseZoomEnvironment accepts only known values", () => {
  assertEquals(parseZoomEnvironment("development"), "development");
  assertEquals(parseZoomEnvironment("production"), "production");
  assertThrows(() => parseZoomEnvironment("staging"), Error);
});

Deno.test("zoom basicAuth encodes client id and secret", () => {
  assertEquals(basicAuth("client", "secret"), "Basic Y2xpZW50OnNlY3JldA==");
});

Deno.test(
  "zoom createMeetingSdkJwt creates role 0 and role 1 JWTs",
  async () => {
    const config = fakeConfig();
    const patientJwt = await createMeetingSdkJwt({
      config,
      meetingNumber: "123456789",
      nowSeconds: 1_700_000_000,
      role: 0,
    });
    const therapistJwt = await createMeetingSdkJwt({
      config,
      meetingNumber: "123456789",
      nowSeconds: 1_700_000_000,
      role: 1,
    });

    assertEquals(patientJwt.split(".").length, 3);
    assertEquals(therapistJwt.split(".").length, 3);
    assert(patientJwt !== therapistJwt);

    const claims = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(patientJwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          (char) => char.charCodeAt(0),
        ),
      ),
    );
    assertEquals(claims.mn, "123456789");
    assertEquals(claims.role, 0);
    assertEquals(claims.exp, 1_700_000_000 + 60 * 60 * 2);
  },
);

Deno.test(
  "zoom webhook challenge response uses secret token HMAC",
  async () => {
    const response = await createZoomChallengeResponse("plain", "secret");

    assertEquals(response.plainToken, "plain");
    assertEquals(
      response.encryptedToken,
      await hmacSha256Hex("secret", "plain"),
    );
  },
);

Deno.test(
  "zoom webhook signature rejects replay and invalid signatures",
  async () => {
    const body = JSON.stringify({ event: "meeting.started" });
    const timestamp = "1700000000";
    const signature = `v0=${await hmacSha256Hex("secret", `v0:${timestamp}:${body}`)}`;

    await verifyZoomWebhookSignature({
      body,
      nowSeconds: 1_700_000_010,
      secretToken: "secret",
      signature,
      timestamp,
    });

    await assertRejects(() =>
      verifyZoomWebhookSignature({
        body,
        nowSeconds: 1_700_001_000,
        secretToken: "secret",
        signature,
        timestamp,
      }),
    );
    await assertRejects(() =>
      verifyZoomWebhookSignature({
        body,
        nowSeconds: 1_700_000_010,
        secretToken: "secret",
        signature: "v0=bad",
        timestamp,
      }),
    );
    await assertRejects(() =>
      verifyZoomWebhookSignature({
        body,
        nowSeconds: 1_700_000_010,
        secretToken: "secret",
        signature: null,
        timestamp,
      }),
    );
  },
);

Deno.test(
  "zoom webhook event key changes with request id for controlled duplicates",
  async () => {
    const body = JSON.stringify({ event: "meeting.started" });
    const base = {
      body,
      eventTs: 1_700_000_000,
      eventType: "meeting.started",
      meetingId: "123",
      meetingUuid: "uuid",
      participantId: null,
    };

    const first = await createZoomWebhookEventKey({
      ...base,
      requestId: "request-a",
    });
    const duplicate = await createZoomWebhookEventKey({
      ...base,
      requestId: "request-a",
    });
    const secondDelivery = await createZoomWebhookEventKey({
      ...base,
      requestId: "request-b",
    });

    assertEquals(first, duplicate);
    assert(first !== secondDelivery);
  },
);

Deno.test("zoom generated passcode respects common Zoom account limits", () => {
  const passcode = generateMeetingPasscode();

  assertEquals(passcode.length, 10);
  assert(/^[A-HJ-NP-Za-km-z2-9]{10}$/.test(passcode));
});

function fakeConfig(): ZoomConfig {
  return {
    accountId: "account",
    apiBaseUrl: "https://api.zoom.us",
    defaultHostUserId: "host",
    environment: "development",
    meetingSdkClientId: "sdk-client",
    meetingSdkClientSecret: "sdk-secret",
    s2sClientId: "s2s-client",
    s2sClientSecret: "s2s-secret",
    webhookSecretToken: "webhook-secret",
  };
}
