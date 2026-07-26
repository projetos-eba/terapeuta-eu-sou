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
  getCurrentWebhookUrl,
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
let openedSessionId = null;
let browser = null;
let fixture = null;
let admin = null;
const cleanupAttempts = [];

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await emergencyCleanup("signal", signal);
    process.exit(1);
  });
}

process.on("uncaughtException", async (error) => {
  await emergencyCleanup("uncaughtException", error.message);
  process.exit(1);
});

process.on("unhandledRejection", async (error) => {
  await emergencyCleanup(
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
  ...assertSupabaseTarget(supabaseRuntime),
  ...webhookState.failures,
];

if (failures.length > 0) block(failures);

await assertPublicWebhookActive();
await assertNoActiveSessions("antes do teste real");

const watchdog = setTimeout(() => {
  void emergencyCleanup("watchdog", "timeout");
}, 60_000);

try {
  fixture = await createZoomRealFixtures({
    admin,
    environment: process.env.ZOOM_ENVIRONMENT,
    runId,
  });

  browser = await chromium.launch({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
    headless: process.env.ZOOM_REAL_TEST_HEADLESS !== "false",
  });

  const therapistPage = await browser.newPage();
  const patientPage = await browser.newPage();
  await loginTherapist(therapistPage, fixture.credentials.therapist);
  await loginPatient(patientPage, fixture.credentials.patient);

  await therapistPage.goto(
    `${baseUrl}/terapeuta/sessoes/${fixture.ids.bookingId}`,
  );
  await therapistPage.getByRole("button", { name: "Entrar na sessao" }).click();
  await expect(
    therapistPage.getByText("Voce entrou como responsavel pela sessao."),
  ).toBeVisible({ timeout: 45_000 });
  await captureSingleActiveSession();

  await patientPage.goto(`${baseUrl}/app/encontros/${fixture.ids.bookingId}`);
  await patientPage.getByRole("button", { name: "Entrar na sessao" }).click();
  await expect(patientPage.getByText(/Voce entrou na sessao/)).toBeVisible({
    timeout: 45_000,
  });

  therapistPage.once("dialog", (dialog) => dialog.accept());
  await therapistPage.getByRole("button", { name: "Encerrar sessao" }).click();
  await expect(
    therapistPage.getByText("A sessao foi encerrada para todos."),
  ).toBeVisible({ timeout: 45_000 });

  await assertNoActiveSessions("apos encerramento");

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
  await emergencyCleanup(
    "test_failure",
    error instanceof Error ? error.message : error,
  );
  throw error;
} finally {
  clearTimeout(watchdog);
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
  }
  if (fixture && admin) {
    try {
      await cleanupZoomRealFixtures({
        admin,
        ids: fixture.ids,
        runId,
      });
    } catch (error) {
      console.error(
        JSON.stringify(error.details ?? sanitizeError(error), null, 2),
      );
      process.exit(1);
    }
  }
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
    process.exit(1);
  }
}

async function captureSingleActiveSession() {
  const sessions = await listActiveSessions();
  const activeSessions = sessions.activeSessions ?? [];
  if (sessions.ok && activeSessions.length === 1) {
    openedSessionId = String(
      activeSessions[0].id ?? activeSessions[0].session_id ?? "",
    );
    if (fixture?.ids) fixture.ids.providerSessionId = openedSessionId;
  }
}

async function loginTherapist(page, credentials) {
  await page.goto(`${baseUrl}/terapeuta/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/, { timeout: 30_000 });
}

async function loginPatient(page, credentials) {
  await page.goto(`${baseUrl}/cliente/login`);
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/, { timeout: 30_000 });
}

async function emergencyCleanup(reason, detail) {
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
  }

  if (openedSessionId) {
    cleanupAttempts.push({ at: new Date().toISOString(), reason });
    const response = await endSessionByApi(openedSessionId);
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
  }
}

function sanitizeError(error) {
  return {
    message: String(error?.message ?? error).slice(0, 240),
    name: error?.name ?? "Error",
  };
}
