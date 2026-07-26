import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { parseStrictBoolean } from "./config.ts";
import { createVideoSdkApiJwt } from "./api-jwt.ts";
import { createVideoSdkJwt } from "./sdk-jwt.ts";
import { hmacSha256Hex } from "./crypto.ts";
import {
  createZoomVideoChallengeResponse,
  verifyZoomVideoWebhookSignature,
} from "./webhook.ts";

Deno.test(
  "parseStrictBoolean fails closed for absent, empty, and invalid values",
  () => {
    assertEquals(parseStrictBoolean(undefined), false);
    assertEquals(parseStrictBoolean(""), false);
    assertEquals(parseStrictBoolean("false"), false);
    assertEquals(parseStrictBoolean("true"), true);
    assertEquals(parseStrictBoolean("yes"), false);
  },
);

Deno.test(
  "createVideoSdkJwt builds role 0 and role 1 claims without exposing secrets",
  async () => {
    const config = { sdkKey: "sdk-key", sdkSecret: "sdk-secret" };
    const now = new Date("2026-07-26T12:00:00.000Z");
    const patientToken = await createVideoSdkJwt({
      config,
      now,
      roleType: 0,
      sessionKey: "abcdef1234567890",
      sessionName: "tesvs-session",
      userKey: "tes-v1-p-123456789012345678901234",
    });
    const therapistToken = await createVideoSdkJwt({
      config,
      now,
      roleType: 1,
      sessionKey: "abcdef1234567890",
      sessionName: "tesvs-session",
      userKey: "tes-v1-t-123456789012345678901234",
    });
    const patientClaims = decodePayload(patientToken);
    const therapistClaims = decodePayload(therapistToken);

    assertEquals(patientClaims.app_key, "sdk-key");
    assertEquals(patientClaims.tpc, "tesvs-session");
    assertEquals(patientClaims.role_type, 0);
    assertEquals(patientClaims.version, 1);
    assertEquals(patientClaims.exp - patientClaims.iat, 1800);
    assertEquals(patientClaims.session_key, "abcdef1234567890");
    assertEquals(patientClaims.user_key, "tes-v1-p-123456789012345678901234");
    assertEquals(therapistClaims.role_type, 1);
  },
);

Deno.test(
  "createVideoSdkJwt rejects tampered role and invalid identity inputs",
  async () => {
    await assertRejects(() =>
      createVideoSdkJwt({
        config: { sdkKey: "sdk-key", sdkSecret: "sdk-secret" },
        roleType: 0,
        sessionName: "tesvs-session",
        userKey: "internal uuid with spaces",
      }),
    );
  },
);

Deno.test(
  "createVideoSdkApiJwt uses API credentials, not SDK credentials",
  async () => {
    const token = await createVideoSdkApiJwt(
      { apiKey: "api-key", apiSecret: "api-secret" },
      new Date("2026-07-26T12:00:00.000Z"),
    );
    const claims = decodePayload(token);

    assertEquals(claims.iss, "api-key");
    assertEquals(claims.exp - claims.iat, 3600);
  },
);

Deno.test(
  "webhook challenge and signature validation use the webhook secret",
  async () => {
    const secret = "webhook-secret";
    const body = JSON.stringify({ event: "session.started" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `v0=${await hmacSha256Hex(secret, `v0:${timestamp}:${body}`)}`;

    await verifyZoomVideoWebhookSignature({
      body,
      secretToken: secret,
      signature,
      timestamp,
    });

    const challenge = await createZoomVideoChallengeResponse("plain", secret);
    assertEquals(challenge, {
      encryptedToken: await hmacSha256Hex(secret, "plain"),
      plainToken: "plain",
    });
  },
);

Deno.test(
  "webhook signature rejects replayed timestamps and invalid signatures",
  async () => {
    await assertRejects(() =>
      verifyZoomVideoWebhookSignature({
        body: "{}",
        secretToken: "secret",
        signature: "v0=invalid",
        timestamp: String(Math.floor(Date.now() / 1000) - 600),
      }),
    );
  },
);

function decodePayload(token: string) {
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
}
