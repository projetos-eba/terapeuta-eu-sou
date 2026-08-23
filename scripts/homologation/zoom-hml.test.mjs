import { describe, expect, it } from "vitest";

import {
  EXPECTED_HML_SUPABASE_REF,
  HML_JOIN_WINDOW_BEFORE_MINUTES,
  MAX_HML_JOIN_WINDOW_WAIT_SECONDS,
  buildSharedUrl,
  collectHarnessFailures,
  createPatientJoinWaitPlan,
  extractSupabaseProjectRef,
  parseNetscapeCookieJar,
  resolveDurationSeconds,
  resolveManualRefreshFallbackEnabled,
  resolveJoinWindowWaitMs,
  resolveCanonicalHmlFixture,
  sanitizeLog,
  sanitizeUrlForEvidence,
  summarizeAccessPayload,
  summarizeAccessRequests,
  summarizeBrowserEvents,
  validateResumeEvidence,
  waitForPatientJoinTransition,
} from "./zoom-hml.mjs";
import { maskIdentifier } from "../zoom/video-sdk-real-helpers.mjs";

describe("zoom HML harness contract", () => {
  const baseEnv = {
    ALLOW_REAL_ZOOM: "true",
    PLAYWRIGHT_BASE_URL:
      "https://hml.terapeutaeusou.com.br/?_vercel_share=preview-token",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
    SUPABASE_URL: `https://${EXPECTED_HML_SUPABASE_REF}.supabase.co`,
    ZOOM_ENVIRONMENT: "development",
    ZOOM_HML_ADMIN_EMAIL: "admin@example.test",
    ZOOM_HML_ADMIN_PASSWORD: "admin-password",
    ZOOM_HML_BOOKING_ID: "f2000000-0000-4000-8000-000000000001",
    ZOOM_HML_PATIENT_EMAIL: "patient@example.test",
    ZOOM_HML_PATIENT_PASSWORD: "patient-password",
    ZOOM_HML_SESSION_PAYMENT_ID: "f2000000-0000-4000-8000-000000000002",
    ZOOM_HML_THERAPIST_EMAIL: "therapist@example.test",
    ZOOM_HML_THERAPIST_PASSWORD: "therapist-password",
    ZOOM_HML_VIDEO_SESSION_ID: "f2000000-0000-4000-8000-000000000003",
  };

  it("builds HML URLs preserving the shared token", () => {
    const url = buildSharedUrl(
      baseEnv.PLAYWRIGHT_BASE_URL,
      "/app/encontros/f2000000-0000-4000-8000-000000000001",
      { next: "/admin" },
    );
    expect(url).toContain("_vercel_share=preview-token");
    expect(url).toContain("next=%2Fadmin");
    expect(url).toContain("/app/encontros/");
  });

  it("parses duration inside the accepted HML window", () => {
    expect(
      resolveDurationSeconds({
        argv: ["--duration-seconds=30"],
        env: {},
      }),
    ).toBe(30);
    expect(
      resolveDurationSeconds({
        argv: [],
        env: { ZOOM_HML_DURATION_SECONDS: "60" },
      }),
    ).toBe(60);
    expect(() =>
      resolveDurationSeconds({
        argv: ["--duration-seconds=29"],
        env: {},
      }),
    ).toThrow(/duration_seconds_invalid/);
  });

  it("parses a restricted Vercel cookie jar without exposing it to evidence", () => {
    const cookies = parseNetscapeCookieJar(
      [
        "# Netscape HTTP Cookie File",
        "#HttpOnly_.terapeutaeusou.com.br\tTRUE\t/\tTRUE\t1790000000\t_vercel_jwt\tprivate-cookie",
      ].join("\n"),
    );

    expect(cookies).toEqual([
      {
        domain: ".terapeutaeusou.com.br",
        expires: 1790000000,
        httpOnly: true,
        name: "_vercel_jwt",
        path: "/",
        secure: true,
        value: "private-cookie",
      },
    ]);
  });

  it("requires a controlled booking shortly before the T-15 window", () => {
    const nowMs = Date.parse("2026-08-11T12:00:00.000Z");
    expect(
      resolveJoinWindowWaitMs({
        nowMs,
        startsAt: "2026-08-11T12:17:00.000Z",
      }),
    ).toBe(2 * 60_000);
    expect(HML_JOIN_WINDOW_BEFORE_MINUTES).toBe(15);
    expect(MAX_HML_JOIN_WINDOW_WAIT_SECONDS).toBe(300);
    expect(() =>
      resolveJoinWindowWaitMs({
        nowMs,
        startsAt: "2026-08-11T12:14:59.000Z",
      }),
    ).toThrow(/booking_not_before_join_window/);
    expect(() =>
      resolveJoinWindowWaitMs({
        nowMs,
        startsAt: "2026-08-11T12:21:00.000Z",
      }),
    ).toThrow(/booking_too_far_from_join_window/);
  });

  it("fails closed when HML env, confirmations or shared URL are missing", () => {
    const failures = collectHarnessFailures({
      argv: [],
      env: {
        ...baseEnv,
        PLAYWRIGHT_BASE_URL: "https://hml.terapeutaeusou.com.br/",
        SUPABASE_URL: "https://localhost:54321",
        ZOOM_HML_PATIENT_PASSWORD: "",
      },
      staticZoomGateFailures: [
        {
          expected: "ALLOW_REAL_ZOOM=true",
          item: "ALLOW_REAL_ZOOM",
          where: "supabase/functions/.env",
        },
      ],
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item: "ALLOW_REAL_ZOOM" }),
        expect.objectContaining({ item: "ZOOM_HML_PATIENT_PASSWORD" }),
        expect.objectContaining({
          item: "PLAYWRIGHT_BASE_URL ou ZOOM_HML_BASE_URL",
        }),
        expect.objectContaining({ item: "SUPABASE_URL" }),
        expect.objectContaining({ item: "--confirm-single-hml-session" }),
        expect.objectContaining({ item: "--confirm-hml-vercel-share" }),
      ]),
    );
  });

  it("allows renewable fixture resolution and privileged one-time sessions without stored passwords or ids", () => {
    const env = {
      ...baseEnv,
      ZOOM_HML_ADMIN_PASSWORD: "",
      ZOOM_HML_BOOKING_ID: "",
      ZOOM_HML_PATIENT_PASSWORD: "",
      ZOOM_HML_SESSION_PAYMENT_ID: "",
      ZOOM_HML_THERAPIST_PASSWORD: "",
      ZOOM_HML_VIDEO_SESSION_ID: "",
    };
    const failures = collectHarnessFailures({
      argv: [
        "--confirm-hml-vercel-share",
        "--confirm-single-hml-session",
        "--resolve-canonical-hml-fixture",
        "--use-admin-magic-link-sessions",
      ],
      env,
      staticZoomGateFailures: [],
    });

    expect(failures).toEqual([]);
  });

  it("resolves only a paid booking with processed Stripe webhook and a fresh video session", async () => {
    const admin = {
      select: async (table) => {
        if (table === "profiles") {
          admin.profileReads = (admin.profileReads ?? 0) + 1;
          return [
            {
              id:
                admin.profileReads === 1
                  ? "f2000000-0000-4000-8000-000000000010"
                  : "f2000000-0000-4000-8000-000000000011",
            },
          ];
        }
        if (table === "patient_profiles") {
          return [{ id: "f2000000-0000-4000-8000-000000000012" }];
        }
        if (table === "therapist_profiles") {
          return [{ id: "f2000000-0000-4000-8000-000000000013" }];
        }
        if (table === "bookings") {
          return [
            {
              id: "f2000000-0000-4000-8000-000000000001",
              starts_at: new Date(Date.now() + 17 * 60_000).toISOString(),
            },
          ];
        }
        if (table === "session_payments") {
          return [
            {
              financial_status: "paid",
              id: "f2000000-0000-4000-8000-000000000002",
              stripe_checkout_session_id: "cs_test_canonical",
            },
          ];
        }
        if (table === "video_sessions") {
          return [{ id: "f2000000-0000-4000-8000-000000000003" }];
        }
        if (table === "stripe_webhook_events") {
          return [{ stripe_event_id: "evt_test_canonical" }];
        }
        return [];
      },
    };

    await expect(
      resolveCanonicalHmlFixture(admin, {
        patientEmail: "patient@example.test",
        therapistEmail: "therapist@example.test",
      }),
    ).resolves.toEqual({
      bookingId: "f2000000-0000-4000-8000-000000000001",
      sessionPaymentId: "f2000000-0000-4000-8000-000000000002",
      videoSessionId: "f2000000-0000-4000-8000-000000000003",
    });
  });

  it("extracts the expected HML Supabase project ref", () => {
    expect(
      extractSupabaseProjectRef(
        `https://${EXPECTED_HML_SUPABASE_REF}.supabase.co`,
      ),
    ).toBe(EXPECTED_HML_SUPABASE_REF);
    expect(extractSupabaseProjectRef("http://127.0.0.1:54321")).toBeNull();
  });

  it("sanitizes share tokens, emails, UUIDs and secrets", () => {
    const raw =
      "https://hml.terapeutaeusou.com.br/app/encontros/f2000000-0000-4000-8000-000000000001?_vercel_share=preview-token&email=patient@example.test&session_id=abc123 Bearer secret-token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature sk_test_123";
    const sanitized = sanitizeLog(raw);
    const sanitizedUrl = sanitizeUrlForEvidence(raw);

    expect(sanitized).not.toContain("preview-token");
    expect(sanitized).not.toContain("patient@example.test");
    expect(sanitized).not.toContain("f2000000-0000-4000-8000-000000000001");
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(sanitized).not.toContain("sk_test_123");
    expect(sanitizedUrl).toContain("[redacted-vercel-share]");
    expect(sanitizedUrl).toContain("[redacted]");
  });

  it("keeps manual refresh fallback opt-in and within the original join timeout budget", () => {
    expect(
      resolveManualRefreshFallbackEnabled({
        argv: [],
        env: {},
      }),
    ).toBe(false);
    expect(
      resolveManualRefreshFallbackEnabled({
        argv: ["--allow-manual-refresh-fallback"],
        env: {},
      }),
    ).toBe(true);
    expect(
      resolveManualRefreshFallbackEnabled({
        argv: [],
        env: { ZOOM_HML_ALLOW_MANUAL_REFRESH_FALLBACK: "true" },
      }),
    ).toBe(true);

    expect(
      createPatientJoinWaitPlan({
        allowManualRefreshFallback: false,
        timeoutMs: 45_000,
      }),
    ).toEqual({
      automaticTimeoutMs: 45_000,
      manualFallbackTimeoutMs: 0,
      timeoutMs: 45_000,
    });
    expect(
      createPatientJoinWaitPlan({
        allowManualRefreshFallback: true,
        timeoutMs: 45_000,
      }),
    ).toEqual({
      automaticTimeoutMs: 35_000,
      manualFallbackTimeoutMs: 10_000,
      timeoutMs: 45_000,
    });
  });

  it("waits for the patient CTA to transition automatically before any manual fallback", async () => {
    const states = [
      { kind: "waiting_for_therapist", text: "Aguardando terapeuta" },
      { kind: "auto_refresh_loading", control: "Atualizar sala" },
      { kind: "join_ready", control: "Entrar no encontro" },
    ];
    let manualRefreshCount = 0;

    const result = await waitForPatientJoinTransition({
      intervalMs: 1,
      observe: async () =>
        states.shift() ?? { kind: "join_ready", control: "Entrar no encontro" },
      timeoutMs: 1_000,
      triggerManualRefresh: async () => {
        manualRefreshCount += 1;
      },
    });

    expect(result.mode).toBe("automatic");
    expect(manualRefreshCount).toBe(0);
    expect(result.observations.map((entry) => entry.kind)).toEqual([
      "waiting_for_therapist",
      "auto_refresh_loading",
      "join_ready",
    ]);
  });

  it("uses manual refresh only as an explicit fallback after the automatic transition budget is exhausted", async () => {
    let manualRefreshCount = 0;
    let fallbackActivated = false;

    const result = await waitForPatientJoinTransition({
      allowManualRefreshFallback: true,
      intervalMs: 1,
      manualRefreshFallbackTimeoutMs: 4,
      observe: async () => {
        if (!fallbackActivated) {
          return {
            control: "Atualizar sala",
            kind: "manual_refresh_available",
          };
        }
        return { control: "Entrar no encontro", kind: "join_ready" };
      },
      timeoutMs: 9,
      triggerManualRefresh: async () => {
        manualRefreshCount += 1;
        fallbackActivated = true;
      },
    });

    expect(result.mode).toBe("manual_refresh_fallback");
    expect(manualRefreshCount).toBe(1);
    expect(result.observations.at(-1)).toEqual(
      expect.objectContaining({ kind: "join_ready" }),
    );
  });

  it("summarizes access payloads without leaking tokenized join data", () => {
    const summary = summarizeAccessPayload({
      data: {
        access: {
          allowed: true,
          availableFrom: "2026-08-11T15:45:00.000Z",
          availableUntil: "2026-08-11T16:15:00.000Z",
          hardEndsAt: "2026-08-11T16:30:00.000Z",
          reason: null,
          serverNow: "2026-08-11T15:45:03.000Z",
          videoSessionStatus: "active",
        },
        roleType: 0,
        sdkKey: "sdk-key",
        sessionName: "session-name",
        token: "secret-token",
      },
      ok: true,
    });

    expect(summary).toEqual({
      access: {
        allowed: true,
        availableFrom: "2026-08-11T15:45:00.000Z",
        availableUntil: "2026-08-11T16:15:00.000Z",
        hardEndsAt: "2026-08-11T16:30:00.000Z",
        reason: null,
        serverNow: "2026-08-11T15:45:03.000Z",
        videoSessionStatus: "active",
      },
      error: null,
      hasJoinPayload: true,
      ok: true,
      roleType: 0,
    });
    expect(JSON.stringify(summary)).not.toContain("secret-token");
  });

  it("summarizes browser and access evidence while preserving console arrays", () => {
    const browserSummary = summarizeBrowserEvents({
      patient: [
        {
          args: [["preview", "therapist_present"], { attempt: [1, 2] }],
          kind: "console",
          level: "info",
          text: "access state",
        },
        {
          kind: "response",
          method: "GET",
          status: 404,
          url: "https://hml.terapeutaeusou.com.br/app/configuracoes/perfil",
        },
        {
          failure: "net::ERR_ABORTED",
          kind: "requestfailed",
          method: "POST",
          url: "https://hml.terapeutaeusou.com.br/api/zoom/video-session-access",
        },
      ],
    });
    const accessSummary = summarizeAccessRequests({
      patient: [
        {
          kind: "access_response",
          request: {
            actorRole: "patient",
            bookingId: maskIdentifier(baseEnv.ZOOM_HML_BOOKING_ID),
            intent: "preview",
          },
          response: {
            access: {
              allowed: false,
              reason: "therapist_not_in_session",
              videoSessionStatus: "ready",
            },
          },
          status: 200,
        },
      ],
    });

    expect(browserSummary.patient.counts).toEqual(
      expect.objectContaining({
        console: 1,
        requestfailed: 1,
        response: 1,
      }),
    );
    expect(browserSummary.patient.samples.console[0].args[0]).toEqual([
      "preview",
      "therapist_present",
    ]);
    expect(browserSummary.patient.responseStatuses["404"]).toBe(1);
    expect(accessSummary.patient.intents.preview).toBe(1);
    expect(accessSummary.patient.statuses["200"]).toBe(1);
  });

  it("accepts only a recent matching T-15 evidence for resume", () => {
    const config = {
      bookingId: baseEnv.ZOOM_HML_BOOKING_ID,
      sessionPaymentId: baseEnv.ZOOM_HML_SESSION_PAYMENT_ID,
      videoSessionId: baseEnv.ZOOM_HML_VIDEO_SESSION_ID,
    };
    const nowMs = Date.parse("2026-08-11T13:46:00.000Z");
    const prior = {
      createdAt: "2026-08-11T13:40:00.000Z",
      hml: true,
      phases: [
        { phase: "patient_before_join_window" },
        { phase: "wait_for_join_window" },
        { phase: "patient_waiting_room" },
      ],
      preflight: {
        booking: { bookingId: expect.anything() },
        sessionPayment: { sessionPaymentId: expect.anything() },
        videoSession: { videoSessionId: expect.anything() },
      },
      runId: "zoom-hml-prior",
    };
    prior.preflight.booking.bookingId = maskIdentifier(config.bookingId);
    prior.preflight.sessionPayment.sessionPaymentId = maskIdentifier(
      config.sessionPaymentId,
    );
    prior.preflight.videoSession.videoSessionId = maskIdentifier(
      config.videoSessionId,
    );

    expect(validateResumeEvidence(prior, config, nowMs)).toEqual({
      runId: "zoom-hml-prior",
    });
  });
});
