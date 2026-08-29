import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import type { ViteDevServer } from "vite";

// Isolated browser regression: no Next auth, Supabase, Zoom, or HML requests.
// Only the SDK and access boundary are simulated; adapter/controls/stage/waiting
// room are the actual application components.
let server: ViteDevServer;
let origin: string;
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
test.beforeAll(async () => {
  const { createServer } = await import("vite");
  const { default: react } = await import("@vitejs/plugin-react");
  server = await createServer({
    configFile: false,
    envDir: false,
    define: { "process.env": "{}" },
    plugins: [
      react(),
      {
        name: "isolated-zoom-preview-entry",
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith("/preview-harness")) return next();
            res.setHeader("Content-Type", "text/html");
            res.end(
              await vite.transformIndexHtml(
                "/preview-harness",
                '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/zoom-preview-entry.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@zoom/videosdk": path.resolve(
          "tests/e2e/fixtures/zoom-preview-sdk.ts",
        ),
        "next/image": path.resolve("tests/e2e/fixtures/zoom-preview-image.tsx"),
        "@": path.resolve("src"),
      },
    },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string")
    throw new Error("local harness unavailable");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await server?.close();
});

async function isolate(context: BrowserContext, role: "patient" | "therapist") {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/auth/session/refresh")
      return route.fulfill({ json: { ok: true } });
    if (url.pathname !== "/api/zoom/video-session-access") return route.abort();
    const now = Date.now();
    return route.fulfill({
      json: {
        ok: true,
        data: {
          access: {
            allowed: true,
            availableFrom: new Date(now - 60_000).toISOString(),
            availableUntil: new Date(now + 3_600_000).toISOString(),
            reason: null,
            videoSessionStatus: "ready",
          },
          roleType: role === "patient" ? 0 : 1,
          sdkKey: "local-test-only",
          token: "local-test-only",
          sessionName: "local-test-only",
          userName: role,
          sessionPasscode: null,
        },
      },
    });
  });
}
async function joinWithCamera(page: Page) {
  await page
    .getByRole("button", { name: "Testar câmera", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Sua prévia de câmera está pronta.",
  );
  await page
    .getByRole("button", { name: "Entrar na sala", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Sala de video" }),
  ).toHaveAttribute("data-session-state", "joined");
}
async function joinWithoutPreflightMedia(page: Page) {
  await page
    .getByRole("button", { name: "Entrar na sala", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Sala de video" }),
  ).toHaveAttribute("data-session-state", "joined");
}
function tile(page: Page, kind: "local" | "remote", userId: number) {
  return page
    .getByTestId(`zoom-${kind}-video`)
    .locator(`video-player-container > video[data-participant-id="${userId}"]`);
}

test("patient late identity recovers self-view beside therapist, then survives camera off, refresh and reentry", async ({
  browser,
}) => {
  const therapistContext = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const patientContext = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 390, height: 844 },
  });
  try {
    await isolate(therapistContext, "therapist");
    await isolate(patientContext, "patient");
    const therapist = await therapistContext.newPage();
    const patient = await patientContext.newPage();
    await therapist.goto(`${origin}/preview-harness?role=therapist`);
    await joinWithCamera(therapist);
    await expect(tile(therapist, "local", 9)).toBeVisible();
    await patient.goto(`${origin}/preview-harness?role=patient`);
    await joinWithCamera(patient);
    await expect(
      patient.getByText("sem prévia neste dispositivo"),
    ).toBeVisible();
    await expect(tile(therapist, "remote", 7)).toBeVisible();
    await patient.evaluate(() => {
      window.__zoomPreviewHarness.identityReady = true;
      window.__zoomPreviewHarness.emit("user-updated", [{ userId: 7 }]);
    });
    await expect(tile(patient, "local", 7)).toBeVisible();
    await expect(tile(patient, "remote", 9)).toBeVisible();
    await expect(patient.locator("video-player-container > video")).toHaveCount(
      2,
    );
    await patient.evaluate(() => {
      window.__zoomPreviewHarness.failDetach = true;
      window.__zoomPreviewHarness.roster[1].bVideoOn = false;
      window.__zoomPreviewHarness.emit("peer-video-state-change", {
        userId: 9,
        action: "Stop",
      });
    });
    await expect(tile(patient, "remote", 9)).toHaveCount(0);
    await expect(tile(patient, "local", 7)).toBeVisible();
    await expect(
      patient.getByText(/Algumas etapas de encerramento/),
    ).toHaveCount(0);
    await patient.reload();
    await joinWithCamera(patient);
    await patient.evaluate(() => {
      window.__zoomPreviewHarness.identityReady = true;
      window.__zoomPreviewHarness.emit("connection-change", {
        state: "Connected",
      });
    });
    await expect(tile(patient, "local", 7)).toBeVisible();
    await patient
      .getByRole("button", { name: "Sair do encontro", exact: true })
      .click();
    await expect(
      patient.getByRole("button", { name: "Entrar na sala" }),
    ).toBeVisible();
    await joinWithCamera(patient);
    await expect(tile(patient, "local", 7)).toBeVisible();
    await expect(tile(patient, "remote", 9)).toBeVisible();
    expect(
      await patient.evaluate(() => window.__zoomPreviewHarness.stats.joins),
    ).toBe(2);
  } finally {
    await patientContext.close();
    await therapistContext.close();
  }
});

test("patient regains self-view after an abrupt device loss and delayed mobile capture", async ({
  browser,
}) => {
  const therapistContext = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  let firstPatientContext: BrowserContext | null = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 390, height: 844 },
  });
  let reentryContext: BrowserContext | null = null;
  try {
    await isolate(therapistContext, "therapist");
    await isolate(firstPatientContext, "patient");
    const therapist = await therapistContext.newPage();
    const firstPatient = await firstPatientContext.newPage();
    await therapist.goto(`${origin}/preview-harness?role=therapist`);
    await joinWithCamera(therapist);
    await firstPatient.goto(`${origin}/preview-harness?role=patient`);
    await joinWithCamera(firstPatient);
    await firstPatient.evaluate(() => {
      window.__zoomPreviewHarness.identityReady = true;
      window.__zoomPreviewHarness.emit("video-capturing-change", {
        state: "Started",
      });
    });
    await expect(tile(firstPatient, "local", 7)).toBeVisible();

    // A new context models a restarted browser process. The replacement
    // provider roster deliberately retains the old same-user participant.
    await firstPatientContext.close();
    firstPatientContext = null;
    reentryContext = await browser.newContext({
      permissions: ["camera", "microphone"],
      viewport: { width: 390, height: 844 },
    });
    await isolate(reentryContext, "patient");
    const reenteredPatient = await reentryContext.newPage();
    await reenteredPatient.goto(
      `${origin}/preview-harness?role=patient&abruptReentry=1&delayedCapture=1`,
    );
    await joinWithoutPreflightMedia(reenteredPatient);
    await expect(tile(reenteredPatient, "remote", 9)).toBeVisible();
    await reenteredPatient
      .getByRole("button", { name: "Ativar câmera", exact: true })
      .click();
    await expect(
      reenteredPatient.getByText("sem prévia neste dispositivo"),
    ).toBeVisible();
    await expect(tile(reenteredPatient, "local", 17)).toBeVisible({
      timeout: 5_000,
    });
    await expect(tile(reenteredPatient, "remote", 9)).toBeVisible();
    await expect(tile(reenteredPatient, "remote", 7)).toHaveCount(0);
    expect(
      await reenteredPatient.evaluate(() => window.__zoomPreviewHarness.stats),
    ).toMatchObject({ joins: 1, starts: 1, stops: 0 });
  } finally {
    await reentryContext?.close();
    await firstPatientContext?.close();
    await therapistContext.close();
  }
});

test("preview retry recovers only rendering and never requests another join", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 390, height: 844 },
  });
  try {
    await isolate(context, "patient");
    const page = await context.newPage();
    await page.goto(`${origin}/preview-harness?role=patient`);
    await page.waitForFunction(() => Boolean(window.__zoomPreviewHarness));
    await page.evaluate(() => {
      window.__zoomPreviewHarness.identityReady = true;
      window.__zoomPreviewHarness.failLocalPreview = true;
    });
    await joinWithCamera(page);
    await expect
      .poll(() =>
        page.evaluate(() => window.__zoomPreviewHarness.stats.localAttaches),
      )
      .toBe(3);
    await expect(tile(page, "remote", 9)).toBeVisible();
    const retry = page.getByRole("button", {
      name: "Tentar mostrar minha câmera",
    });
    const box = await retry.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: testInfo.outputPath("preview-degraded-mobile.png"),
      fullPage: true,
    });
    await page.evaluate(() => {
      window.__zoomPreviewHarness.failLocalPreview = false;
    });
    await retry.click();
    await expect(tile(page, "local", 7)).toBeVisible();
    expect(
      await page.evaluate(() => window.__zoomPreviewHarness.stats),
    ).toMatchObject({ joins: 1, starts: 1, stops: 0 });
    await page.screenshot({
      path: testInfo.outputPath("preview-recovered-mobile.png"),
      fullPage: true,
    });
    await expect(page.getByText(/Algumas etapas de encerramento/)).toHaveCount(
      0,
    );
  } finally {
    await context.close();
  }
});
