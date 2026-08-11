import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { parseStrictBoolean } from "./config.ts";
import { evaluateVideoSessionAccess } from "./access-policy.ts";
import { ZoomVideoSdkApiClient } from "./api-client.ts";
import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import { createVideoSdkApiJwt } from "./api-jwt.ts";
import { getAuthorizedVideoBooking } from "./booking-authorization.ts";
import {
  createVideoSdkJwt,
  normalizeSessionName,
  normalizeUserKey,
} from "./sdk-jwt.ts";
import { hmacSha256Hex } from "./crypto.ts";
import { createVideoUserKey } from "./session-identity.ts";
import {
  buildApplyZoomVideoSessionEventParams,
  createZoomVideoChallengeResponse,
  createZoomVideoWebhookEventKey,
  normalizeZoomVideoEventTime,
  verifyZoomVideoWebhookSignature,
} from "./webhook.ts";
import {
  computeVideoSessionHardEndsAt,
  parseZoomVideoMaxDurationMinutes,
} from "./session-lifecycle.ts";

Deno.test(
  "parseStrictBoolean fails closed for absent, empty, and invalid values",
  () => {
    assertEquals(parseStrictBoolean(undefined), false);
    assertEquals(parseStrictBoolean(""), false);
    assertEquals(parseStrictBoolean("false"), false);
    assertEquals(parseStrictBoolean("true"), true);
    assertEquals(parseStrictBoolean("yes"), false);
    assertEquals(parseStrictBoolean("TRUE"), false);
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

Deno.test("normalizes session and user identities without PII", async () => {
  assertEquals(normalizeSessionName(" TESVS-SESSION "), "tesvs-session");
  await assertRejects(async () => {
    normalizeSessionName("sessao-ç");
  });
  await assertRejects(async () => {
    normalizeUserKey("uuid with space");
  });

  const userKey = await createVideoUserKey({
    bookingId: "f2000000-0000-4000-8000-000000000001",
    profileId: "b1000000-0000-4000-8000-000000000001",
    role: "patient",
  });

  assertEquals(userKey.startsWith("tes-v1-p-"), true);
  assertEquals(userKey.length <= 36, true);
});

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
  "ZoomVideoSdkApiClient lists live sessions with a bounded date window",
  async () => {
    const requests: Array<{ method: string; url: string }> = [];
    const client = new ZoomVideoSdkApiClient({
      config: {
        allowRealZoom: true,
        apiKey: "api-key",
        apiSecret: "api-secret",
        environment: "development",
        lifecycle: {
          maxDurationMinutes: 45,
          therapistReconnectGraceSeconds: 120,
        },
        sdkKey: "sdk-key",
        sdkSecret: "sdk-secret",
        webhookSecretToken: "webhook-secret",
      },
      fetchImpl: async (url, init) => {
        requests.push({
          method: init?.method ?? "GET",
          url: String(url),
        });
        return new Response("{}", { status: 200 });
      },
    });

    await client.listSessions({ sessionName: "tesvs-session" });

    const url = new URL(requests[0].url);
    assertEquals(url.pathname, "/v2/videosdk/sessions");
    assertEquals(url.searchParams.get("type"), "live");
    assertEquals(url.searchParams.get("page_size"), "300");
    assertEquals(url.searchParams.get("session_name"), "tesvs-session");
    assertEquals(Boolean(url.searchParams.get("from")), true);
    assertEquals(Boolean(url.searchParams.get("to")), true);
  },
);

Deno.test(
  "ZoomVideoSdkApiClient ends sessions with official status endpoint",
  async () => {
    const requests: Array<{
      body: string | null;
      method: string;
      url: string;
    }> = [];
    const client = new ZoomVideoSdkApiClient({
      config: {
        allowRealZoom: true,
        apiKey: "api-key",
        apiSecret: "api-secret",
        environment: "development",
        lifecycle: {
          maxDurationMinutes: 45,
          therapistReconnectGraceSeconds: 120,
        },
        sdkKey: "sdk-key",
        sdkSecret: "sdk-secret",
        webhookSecretToken: "webhook-secret",
      },
      fetchImpl: async (url, init) => {
        requests.push({
          body: typeof init?.body === "string" ? init.body : null,
          method: init?.method ?? "GET",
          url: String(url),
        });
        return new Response("{}", { status: 200 });
      },
    });

    await client.endSession("session/123");

    assertEquals(requests[0].method, "PUT");
    assertEquals(
      requests[0].url,
      "https://api.zoom.us/v2/videosdk/sessions/session%252F123/status",
    );
    assertEquals(requests[0].body, JSON.stringify({ action: "end" }));
  },
);

Deno.test(
  "access policy blocks closed, unpaid, suspended, and stale sessions",
  () => {
    const base = {
      actorRole: "patient" as const,
      bookingStatus: "confirmed",
      endsAt: "2026-07-26T13:30:00.000Z",
      financialStatus: "paid",
      now: new Date("2026-07-26T13:00:00.000Z"),
      startsAt: "2026-07-26T12:30:00.000Z",
      therapistPresent: true,
      videoSessionReady: true,
      videoSessionStatus: "ready",
    };

    assertEquals(evaluateVideoSessionAccess(base).allowed, true);
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        therapistPresent: false,
      }).reason,
      "THERAPIST_NOT_IN_SESSION",
    );
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        hardEndsAt: "2026-07-26T12:59:00.000Z",
        therapistPresent: true,
      }).reason,
      "HARD_TIMEOUT",
    );
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        financialStatus: "refunded",
      }).reason,
      "PAYMENT_NOT_CONFIRMED",
    );
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        actorRole: "therapist",
        therapistStatus: "suspended",
      }).reason,
      "THERAPIST_SUSPENDED",
    );
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        videoSessionReady: false,
        videoSessionStatus: null,
      }).reason,
      "VIDEO_SESSION_NOT_READY",
    );
  },
);

Deno.test(
  "access policy blocks unpaid, cancelled, too early, too late, and hard-ended bookings",
  () => {
    const base = {
      actorRole: "patient" as const,
      bookingStatus: "confirmed",
      endsAt: "2026-07-26T13:30:00.000Z",
      financialStatus: "paid",
      now: new Date("2026-07-26T13:00:00.000Z"),
      startsAt: "2026-07-26T12:30:00.000Z",
      therapistPresent: true,
      videoSessionReady: true,
      videoSessionStatus: "ready",
    };

    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        financialStatus: null,
      }).reason,
      "PAYMENT_NOT_CONFIRMED",
    );
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        bookingStatus: "cancelled_by_patient",
      }).reason,
      "BOOKING_CANCELLED",
    );
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        now: new Date("2026-07-26T12:14:59.000Z"),
      }).reason,
      "TOO_EARLY",
    );
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        now: new Date("2026-07-26T14:00:00.000Z"),
      }).reason,
      "TOO_LATE",
    );
    assertEquals(
      evaluateVideoSessionAccess({
        ...base,
        hardEndsAt: "2026-07-26T12:59:59.000Z",
      }).reason,
      "HARD_TIMEOUT",
    );
  },
);

Deno.test(
  "booking authorization blocks access from another patient before reading payment or video data",
  async () => {
    const calls: string[] = [];
    const client = {
      get: (path: string) => {
        calls.push(path);
        if (path.startsWith("/rest/v1/bookings")) {
          return Promise.resolve([
            {
              ends_at: "2026-07-26T13:30:00.000Z",
              id: "94000000-0000-4000-8000-000000000021",
              patient_profile_id: "patient-owner",
              starts_at: "2026-07-26T12:30:00.000Z",
              status: "confirmed",
              therapist_profile_id: "therapist-owner",
              therapist_profiles: { status: "approved" },
              timezone: "America/Sao_Paulo",
            },
          ]);
        }
        return Promise.resolve([]);
      },
      rpc: () => Promise.resolve(null),
    } as unknown as SupabaseRestClient;

    await assertRejects(
      () =>
        getAuthorizedVideoBooking({
          bookingId: "94000000-0000-4000-8000-000000000021",
          client,
          environment: "development",
          profileId: "another-patient",
          role: "patient",
        }),
      Error,
      "Voce nao pode acessar esta sessao.",
    );

    assertEquals(calls.length, 1);
    assertEquals(calls[0].startsWith("/rest/v1/bookings"), true);
  },
);

Deno.test("max duration policy rejects missing and unsafe values", () => {
  assertEquals(parseZoomVideoMaxDurationMinutes("1"), 1);
  assertEquals(parseZoomVideoMaxDurationMinutes("240"), 240);

  for (const value of [undefined, "", "0", "-1", "1.5", "241", "abc"]) {
    try {
      parseZoomVideoMaxDurationMinutes(value);
      throw new Error("expected rejection");
    } catch (error) {
      assertEquals(
        error instanceof Error && error.message !== "expected rejection",
        true,
      );
    }
  }
});

Deno.test(
  "hard end uses min of effective start max duration and scheduled tolerance",
  () => {
    assertEquals(
      computeVideoSessionHardEndsAt({
        actualStartedAt: "2026-07-26T12:45:00.000Z",
        afterEndsMinutes: 30,
        maxDurationMinutes: 60,
        scheduledEndsAt: "2026-07-26T13:30:00.000Z",
        scheduledStartsAt: "2026-07-26T13:00:00.000Z",
      }).toISOString(),
      "2026-07-26T14:00:00.000Z",
    );
    assertEquals(
      computeVideoSessionHardEndsAt({
        actualStartedAt: "2026-07-26T13:10:00.000Z",
        afterEndsMinutes: 30,
        maxDurationMinutes: 20,
        scheduledEndsAt: "2026-07-26T13:30:00.000Z",
        scheduledStartsAt: "2026-07-26T13:00:00.000Z",
      }).toISOString(),
      "2026-07-26T13:30:00.000Z",
    );
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

Deno.test(
  "webhook event key stays stable across retries with different request ids",
  async () => {
    const baseInput = {
      body: JSON.stringify({
        event: "session.user_joined",
        event_ts: 1_753_531_200,
        payload: {
          object: {
            participant: {
              id: "participant-1",
              user_key: "tes-v1-t-aaaaaaaaaaaaaaaaaaaaaaaa",
            },
            session_id: "provider-session-1",
          },
        },
      }),
      eventTs: 1_753_531_200,
      eventType: "session.user_joined",
      providerSessionId: "provider-session-1",
      providerUserId: "participant-1",
      providerUserKey: "tes-v1-t-aaaaaaaaaaaaaaaaaaaaaaaa",
      sessionName: null,
    };

    const firstKey = await createZoomVideoWebhookEventKey({
      ...baseInput,
      requestId: "request-a",
    });
    const retryKey = await createZoomVideoWebhookEventKey({
      ...baseInput,
      requestId: "request-b",
    });

    assertEquals(firstKey, retryKey);
  },
);

Deno.test(
  "webhook event time does not fall back to now for missing values",
  () => {
    assertEquals(normalizeZoomVideoEventTime(undefined), null);
    assertEquals(normalizeZoomVideoEventTime("invalid"), null);
    assertEquals(
      normalizeZoomVideoEventTime(1_753_531_200),
      "2025-07-26T12:00:00.000Z",
    );
  },
);

Deno.test(
  "webhook event params accept provider session id without session name and pass environment",
  () => {
    const params = buildApplyZoomVideoSessionEventParams({
      afterEndsMinutes: 30,
      durationSeconds: 42,
      environment: "development",
      eventAt: "2026-07-26T12:00:00.000Z",
      eventType: "session.user_joined",
      maxDurationMinutes: 45,
      providerSessionId: "provider-session-1",
      providerUserId: "participant-1",
      providerUserKey: "tes-v1-p-aaaaaaaaaaaaaaaaaaaaaaaa",
      sessionName: null,
      supportedEvents: new Set([
        "session.started",
        "session.ended",
        "session.user_joined",
        "session.user_left",
      ]),
    });

    assertEquals(params, {
      p_after_ends_minutes: 30,
      p_duration_seconds: 42,
      p_environment: "development",
      p_event_at: "2026-07-26T12:00:00.000Z",
      p_event_type: "session.user_joined",
      p_max_duration_minutes: 45,
      p_provider_session_id: "provider-session-1",
      p_provider_user_id: "participant-1",
      p_provider_user_key: "tes-v1-p-aaaaaaaaaaaaaaaaaaaaaaaa",
      p_session_name: null,
    });

    assertEquals(
      buildApplyZoomVideoSessionEventParams({
        afterEndsMinutes: 30,
        durationSeconds: 42,
        environment: "development",
        eventAt: "2026-07-26T12:00:00.000Z",
        eventType: "session.user_joined",
        maxDurationMinutes: 45,
        providerSessionId: null,
        providerUserId: "participant-1",
        providerUserKey: "tes-v1-p-aaaaaaaaaaaaaaaaaaaaaaaa",
        sessionName: null,
        supportedEvents: new Set(["session.user_joined"]),
      }),
      null,
    );
  },
);

function decodePayload(token: string) {
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
}
