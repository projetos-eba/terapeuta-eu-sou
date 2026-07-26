import crypto from "node:crypto";

import { chromium, expect } from "@playwright/test";

import { loadZoomVideoSdkEnv } from "./video-sdk-env-loader.mjs";
import {
  assertStaticRealZoomGates,
  endSessionByApi,
  listActiveSessions,
  maskIdentifier,
  printGateFailure,
  signZoomWebhookBody,
} from "./video-sdk-real-helpers.mjs";
import {
  cleanupZoomRealFixtures,
  createZoomRealFixtures,
} from "./video-sdk-real-fixtures.mjs";
import {
  assertVerifiedWebhookState,
  clearProviderSessionState,
  getCurrentWebhookUrl,
  recordProviderSessionState,
} from "./video-sdk-real-state.mjs";
import {
  assertSupabaseTarget,
  createSupabaseAdmin,
  getSupabaseRuntime,
} from "./video-sdk-real-supabase.mjs";

loadZoomVideoSdkEnv();

const startedAt = new Date();
const requestId = crypto.randomUUID();
const runId = `zoom-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
const baseUrl = resolveBaseUrl();
const slowMo = resolveSlowMo();
let openedSessionId = null;
let browser = null;
let therapistContext = null;
let patientContext = null;
let fixture = null;
let admin = null;
const cleanupAttempts = [];
let cleanupPromise = null;
let currentPhase = "bootstrap";

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await cleanupOnce("signal", signal);
    process.exit(1);
  });
}

process.on("uncaughtException", async (error) => {
  await cleanupOnce("uncaughtException", error.message);
  process.exit(1);
});

process.on("unhandledRejection", async (error) => {
  await cleanupOnce(
    "unhandledRejection",
    error instanceof Error ? error.message : "UNKNOWN",
  );
  process.exit(1);
});

const supabaseRuntime = await getSupabaseRuntime();
admin = createSupabaseAdmin(supabaseRuntime);
const webhookState = await assertVerifiedWebhookState();
const failures = [
  ...assertStaticRealZoomGates(),
  ...assertManualMarketplaceGate(),
  ...assertSupabaseTarget(supabaseRuntime),
  ...webhookState.failures,
];

if (failures.length > 0) block(failures);

await assertPublicWebhookActive();
await assertNoActiveSessions("antes do teste real");

const abortController = new AbortController();
let watchdog = null;

try {
  const watchdogPromise = createWatchdog(abortController);
  await Promise.race([runRealFlow(abortController.signal), watchdogPromise]);

  console.log(
    JSON.stringify(
      {
        baseUrl,
        finishedAt: new Date().toISOString(),
        ok: true,
        requestId,
        runId: maskIdentifier(runId),
        startedAt: startedAt.toISOString(),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify(sanitizeFailure(error), null, 2));
  await cleanupOnce(
    "test_failure",
    error instanceof Error ? error.message : error,
  );
  throw error;
} finally {
  if (watchdog) clearTimeout(watchdog);
  await cleanupOnce("finally", "normal");
}

function resolveBaseUrl() {
  const arg = process.argv.find((item) => item.startsWith("--base-url"));
  if (arg?.includes("="))
    return normalizeBaseUrl(arg.split("=").slice(1).join("="));
  const index = process.argv.indexOf("--base-url");
  if (index >= 0 && process.argv[index + 1]) {
    return normalizeBaseUrl(process.argv[index + 1]);
  }
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
  );
}

function normalizeBaseUrl(value) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("base_url_invalid");
  }
  return parsed.toString().replace(/\/$/, "");
}

function block(manualFailures) {
  printGateFailure(manualFailures, "npm run zoom:video-sdk:test:real");
  process.exit(1);
}

function assertManualMarketplaceGate() {
  const confirmed =
    process.argv.includes("--confirm-zoom-marketplace") &&
    process.argv.includes("--confirm-single-real-session") &&
    process.argv.includes("--headed") &&
    slowMo > 0;
  if (confirmed) return [];
  return [
    {
      expected:
        "confirmacao manual momentanea, Playwright visivel e slow motion",
      item: "--confirm-zoom-marketplace --confirm-single-real-session --headed --slow-mo=<ms>",
      where: "Zoom Build Platform antes de abrir sessao real",
    },
  ];
}

async function assertPublicWebhookActive() {
  const url = await getCurrentWebhookUrl();
  const body = JSON.stringify({
    event: "endpoint.url_validation",
    event_ts: Date.now(),
    payload: { plainToken: "real-test-gate-token" },
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
    block([
      {
        expected: "URL ngrok ativa e apontando para zoom-webhook local",
        item: `HTTP ${response.status}`,
        where: "webhook publico temporario",
      },
    ]);
  }
}

async function assertNoActiveSessions(where) {
  const sessions = await listActiveSessions();
  if (!sessions.ok) {
    block([
      {
        expected: "API Zoom Video SDK acessivel",
        item: `Zoom API HTTP ${sessions.status}`,
        where,
      },
    ]);
  }

  if ((sessions.activeSessions ?? []).length > 0) {
    console.error(
      JSON.stringify(
        {
          activeSessionCount: sessions.activeSessions.length,
          blocked: true,
          message: "Existe sessao real ativa. Nao abrirei outra.",
          sessions: sessions.activeSessions.map((session) => ({
            id: maskIdentifier(String(session.id ?? session.session_id ?? "")),
            status: String(session.status ?? "unknown"),
          })),
          where,
        },
        null,
        2,
      ),
    );
    throw new Error("active_sessions_blocked");
  }
}

async function runRealFlow(signal) {
  throwIfAborted(signal);
  fixture = await phase("fixtures_create", () =>
    createZoomRealFixtures({
      admin,
      environment: process.env.ZOOM_ENVIRONMENT,
      runId,
    }),
  );

  browser = await phase("browser_launch", () =>
    chromium.launch({
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
      headless: false,
      slowMo,
    }),
  );
  therapistContext = await phase("therapist_context_create", () =>
    browser.newContext({
      permissions: ["microphone"],
    }),
  );
  patientContext = await phase("patient_context_create", () =>
    browser.newContext({
      permissions: ["microphone"],
    }),
  );

  const therapistPage = await therapistContext.newPage();
  const patientPage = await patientContext.newPage();
  await phase("therapist_login", () =>
    loginTherapist(therapistPage, fixture.credentials.therapist),
  );
  await phase("context_isolation_check", () => assertContextsIsolated());
  throwIfAborted(signal);
  await phase("patient_login", () =>
    loginPatient(patientPage, fixture.credentials.patient),
  );

  await phase("patient_first_blocked", async () => {
    await patientPage.goto(`${baseUrl}/app/encontros/${fixture.ids.bookingId}`);
    await expect(
      patientPage.getByText("Aguardando o terapeuta iniciar a sessao."),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      patientPage.getByRole("button", { name: "Entrar na sessao" }),
    ).toHaveCount(0);
  });

  await phase("therapist_join", async () => {
    await therapistPage.goto(
      `${baseUrl}/terapeuta/sessoes/${fixture.ids.bookingId}`,
    );
    await therapistPage
      .getByRole("button", { name: "Entrar na sessao" })
      .click();
    await expect(
      therapistPage.getByText("Voce entrou como responsavel pela sessao."),
    ).toBeVisible({ timeout: 45_000 });
  });
  await phase("provider_session_capture", () =>
    captureActiveSessionForFixture(signal),
  );
  await phase("therapist_presence_webhook", () =>
    waitForTherapistPresence(signal),
  );

  await phase("patient_join", async () => {
    await patientPage.getByRole("button", { name: "Atualizar sala" }).click();
    await expect(
      patientPage.getByRole("button", { name: "Entrar na sessao" }),
    ).toBeVisible({ timeout: 45_000 });
    await patientPage.getByRole("button", { name: "Entrar na sessao" }).click();
    await expect(patientPage.getByText(/Voce entrou na sessao/)).toBeVisible({
      timeout: 45_000,
    });
  });
  throwIfAborted(signal);

  await phase("host_end_session", async () => {
    therapistPage.once("dialog", (dialog) => dialog.accept());
    await therapistPage
      .getByRole("button", { name: "Encerrar sessao" })
      .click();
    await expect(
      therapistPage.getByText("A sessao foi encerrada para todos."),
    ).toBeVisible({ timeout: 45_000 });
  });

  await phase("webhook_end_evidence", () =>
    waitForSessionEndedEvidence(signal),
  );
  await phase("post_end_active_session_check", () =>
    assertNoActiveSessions("apos encerramento"),
  );
  await phase("clear_provider_session_state", async () => {
    await clearProviderSessionState({ requestId }).catch(() => undefined);
    openedSessionId = null;
  });
}

async function captureActiveSessionForFixture(signal) {
  const session = await poll({
    signal,
    intervalMs: 2000,
    timeoutMs: 20_000,
    task: async () => {
      const sessions = await listActiveSessions({
        sessionName: fixture.videoSession?.sessionName,
      });
      if (!sessions.ok) {
        throw new Error(`zoom_active_sessions_http_${sessions.status}`);
      }
      const activeSessions = sessions.activeSessions ?? [];
      const matching = activeSessions.filter((active) =>
        matchesFixtureSession(active),
      );
      if (matching.length === 1) return matching[0];
      if (activeSessions.length === 1) return activeSessions[0];
      return null;
    },
  });

  openedSessionId = String(session.id ?? session.session_id ?? "");
  if (!openedSessionId) {
    throw new Error("zoom_provider_session_id_not_found");
  }

  fixture.ids.providerSessionId = openedSessionId;
  await recordProviderSessionState({
    capturedAt: new Date().toISOString(),
    providerSessionId: openedSessionId,
    requestId,
    runIdHash: maskIdentifier(runId),
  });
  await admin.patch("video_sessions", `id=eq.${fixture.ids.videoSessionId}`, {
    last_synced_at: new Date().toISOString(),
    provider_session_id: openedSessionId,
  });
}

function matchesFixtureSession(session) {
  const sessionKey = String(session.session_key ?? session.sessionKey ?? "");
  const sessionName = String(session.session_name ?? session.sessionName ?? "");
  const sessionId = String(session.id ?? session.session_id ?? "");
  return (
    (fixture.videoSession?.sessionKey &&
      sessionKey === fixture.videoSession.sessionKey) ||
    (fixture.videoSession?.sessionName &&
      sessionName === fixture.videoSession.sessionName) ||
    (openedSessionId && sessionId === openedSessionId)
  );
}

async function waitForSessionEndedEvidence(signal) {
  await poll({
    signal,
    intervalMs: 2000,
    timeoutMs: 45_000,
    task: async () => {
      const [videoSession] = await admin.select(
        "video_sessions",
        `select=status,actual_started_at,actual_ended_at,provider_session_id&booking_id=eq.${fixture.ids.bookingId}&limit=1`,
      );
      const events = await admin.select(
        "zoom_video_webhook_events",
        `select=event_type,processing_status&provider_session_id=eq.${encodeURIComponent(openedSessionId)}&processing_status=eq.processed`,
      );
      const participations = await admin.select(
        "video_session_participations",
        `select=participant_role,event_type,left_at&booking_id=eq.${fixture.ids.bookingId}`,
      );
      const eventTypes = new Set(events.map((event) => event.event_type));
      const rolesLeft = new Set(
        participations
          .filter(
            (participation) =>
              participation.event_type === "session.user_left" &&
              participation.left_at,
          )
          .map((participation) => participation.participant_role),
      );

      if (
        videoSession?.status === "ended" &&
        videoSession.actual_started_at &&
        videoSession.actual_ended_at &&
        eventTypes.has("session.started") &&
        eventTypes.has("session.ended") &&
        eventTypes.has("session.user_joined") &&
        eventTypes.has("session.user_left") &&
        rolesLeft.has("therapist") &&
        rolesLeft.has("patient")
      ) {
        return true;
      }

      return null;
    },
  });
}

async function waitForTherapistPresence(signal) {
  await poll({
    signal,
    intervalMs: 2000,
    timeoutMs: 45_000,
    task: async () => {
      const [videoSession] = await admin.select(
        "video_sessions",
        `select=status,provider_session_id,therapist_first_joined_at,therapist_present,hard_ends_at&booking_id=eq.${fixture.ids.bookingId}&limit=1`,
      );

      if (
        videoSession?.status === "active" &&
        videoSession.provider_session_id &&
        videoSession.therapist_first_joined_at &&
        videoSession.therapist_present === true &&
        videoSession.hard_ends_at
      ) {
        return true;
      }

      return null;
    },
  });
}

async function assertContextsIsolated() {
  const patientCookies = await patientContext.cookies();
  const inheritedAuthCookie = patientCookies.find((cookie) =>
    /sb-|supabase|auth/i.test(cookie.name),
  );
  if (inheritedAuthCookie) {
    throw new Error("patient_context_inherited_auth_cookie");
  }
}

function createWatchdog(abortController) {
  return new Promise((_, reject) => {
    watchdog = setTimeout(() => {
      const error = new Error("watchdog_timeout");
      abortController.abort(error);
      void cleanupOnce("watchdog", "timeout").finally(() => reject(error));
    }, 180_000);
  });
}

function resolveSlowMo() {
  const inline = process.argv.find((item) => item.startsWith("--slow-mo="));
  const raw = inline
    ? inline.split("=").slice(1).join("=")
    : process.argv[process.argv.indexOf("--slow-mo") + 1];
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function loginTherapist(page, credentials) {
  await page.goto(`${baseUrl}/terapeuta/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await submitLoginForm(page, {
    buttonName: "Entrar como terapeuta",
    endpoint: "/api/auth/therapist/login",
  });
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/, { timeout: 30_000 });
}

async function loginPatient(page, credentials) {
  await page.goto(`${baseUrl}/cliente/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await submitLoginForm(page, {
    buttonName: "Entrar",
    endpoint: "/api/auth/client/login",
  });
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/, { timeout: 30_000 });
}

async function submitLoginForm(page, { buttonName, endpoint }) {
  const button = page.getByRole("button", { name: buttonName });
  await expect(button).toBeVisible({ timeout: 15_000 });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  const result = await page.evaluate(async (loginEndpoint) => {
    const form = document.querySelector("form");
    if (!form) return { ok: false, status: 0, message: "missing_form" };

    const formData = new FormData(form);
    const response = await fetch(loginEndpoint, {
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const data = await response
      .json()
      .catch(() => ({ ok: false, message: "invalid_json" }));

    if (data.ok && typeof data.redirectTo === "string") {
      window.location.assign(data.redirectTo);
      return { ok: true, status: response.status };
    }

    return {
      ok: false,
      status: response.status,
      message: typeof data.message === "string" ? data.message : "login_failed",
    };
  }, endpoint);

  if (!result.ok) {
    throw new Error(`login_failed_status_${result.status}_${result.message}`);
  }
}

async function cleanupOnce(reason, detail) {
  cleanupPromise ??= doCleanup(reason, detail);
  return cleanupPromise;
}

async function doCleanup(reason, detail) {
  if (patientContext) {
    await patientContext.close().catch(() => undefined);
    patientContext = null;
  }
  if (therapistContext) {
    await therapistContext.close().catch(() => undefined);
    therapistContext = null;
  }
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
  }

  if (!openedSessionId && fixture?.videoSession?.sessionName) {
    openedSessionId = await discoverOpenSessionId().catch(() => null);
    if (openedSessionId && fixture?.ids) {
      fixture.ids.providerSessionId = openedSessionId;
      await clearProviderSessionState({ requestId }).catch(() => undefined);
    }
  }

  if (openedSessionId) {
    cleanupAttempts.push({ at: new Date().toISOString(), reason });
    const response = await endSessionByApi(openedSessionId);
    await poll({
      intervalMs: 2000,
      timeoutMs: 20_000,
      task: async () => {
        const sessions = await listActiveSessions({
          sessionName: fixture.videoSession?.sessionName,
        });
        if (!sessions.ok) return true;
        const stillOpen = (sessions.activeSessions ?? []).some((session) =>
          matchesFixtureSession(session),
        );
        return stillOpen ? null : true;
      },
    }).catch(() => undefined);
    await clearProviderSessionState({ requestId }).catch(() => undefined);
    console.error(
      JSON.stringify(
        {
          cleanupAttempts,
          detail: String(detail ?? "UNKNOWN").slice(0, 160),
          requestId,
          sessionId: maskIdentifier(openedSessionId),
          startedAt: startedAt.toISOString(),
          status: response.status,
        },
        null,
        2,
      ),
    );
    openedSessionId = null;
  }

  if (fixture && admin) {
    try {
      await cleanupZoomRealFixtures({
        admin,
        ids: fixture.ids,
        runId,
      });
      fixture = null;
    } catch (error) {
      console.error(
        JSON.stringify(error.details ?? sanitizeError(error), null, 2),
      );
      process.exit(1);
    }
  }
}

async function discoverOpenSessionId() {
  const bySessionName = await listActiveSessions({
    sessionName: fixture.videoSession?.sessionName,
  });
  if (!bySessionName.ok) return null;
  const namedActive = bySessionName.activeSessions ?? [];
  if (namedActive.length === 1) {
    return String(namedActive[0].id ?? namedActive[0].session_id ?? "") || null;
  }

  const allActive = await listActiveSessions();
  if (!allActive.ok) return null;
  const active = allActive.activeSessions ?? [];
  if (active.length === 1) {
    return String(active[0].id ?? active[0].session_id ?? "") || null;
  }

  return null;
}

async function poll({ intervalMs, signal, task, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    try {
      const value = await task();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw lastError ?? new Error("poll_timeout");
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error("operation_aborted");
  }
}

function sanitizeError(error) {
  return {
    message: String(error?.message ?? error).slice(0, 240),
    name: error?.name ?? "Error",
  };
}

async function phase(name, callback) {
  currentPhase = name;
  console.error(
    JSON.stringify({
      code: "ZOOM_REAL_PHASE",
      phase: name,
      requestId,
      runId: maskIdentifier(runId),
    }),
  );
  return callback();
}

function sanitizeFailure(error) {
  return {
    code: "ZOOM_REAL_TEST_FAILED",
    error: sanitizeError(error),
    phase: currentPhase,
    requestId,
    runId: maskIdentifier(runId),
    sanitizedIds: fixture?.sanitized ?? null,
  };
}
