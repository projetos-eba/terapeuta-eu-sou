import { expect, test } from "@playwright/test";

const patientEmail =
  process.env.PATIENT_E2E_EMAIL ?? "paciente.ana@example.test";
const patientPassword = process.env.PATIENT_E2E_PASSWORD ?? "tes-mock-password";
const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";
const bookingId =
  process.env.ZOOM_E2E_BOOKING_ID ?? "f2000000-0000-4000-8000-000000000001";

test.describe("Zoom Video SDK session gate", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPatient(page);
  });

  test("clicks the real join control without exposing a token when backend blocks access", async ({
    page,
  }) => {
    const accessRequests: unknown[] = [];

    await page.route("**/api/zoom/video-session-access", async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      accessRequests.push(body);

      if (body.intent === "preview") {
        await route.fulfill({
          body: JSON.stringify({
            data: {
              access: {
                allowed: true,
                availableFrom: "2026-07-26T12:45:00.000Z",
                availableUntil: "2026-07-26T14:00:00.000Z",
                reason: null,
                videoSessionStatus: "ready",
              },
            },
            ok: true,
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          error: {
            code: "video_session_not_ready",
            message: "A sala ainda esta em preparacao.",
          },
          ok: false,
        }),
        contentType: "application/json",
        status: 409,
      });
    });

    await page.goto(`/app/encontros/${bookingId}`);

    await expect(page.getByLabel("Sala de video")).toBeVisible();
    await page.getByRole("button", { name: "Entrar no encontro" }).click();

    await expect(
      page.getByText("A sala ainda esta em preparacao."),
    ).toBeVisible();
    await expect.poll(() => accessRequests.length).toBeGreaterThanOrEqual(2);
    expect(accessRequests[0]).toMatchObject({
      actorRole: "patient",
      bookingId,
      intent: "preview",
    });
    expect(accessRequests.at(-1)).toMatchObject({
      actorRole: "patient",
      bookingId,
      intent: "join",
    });
    await expect(page.locator("body")).not.toContainText(
      /eyJ|sdkSecret|jwt-token/i,
    );
  });

  test("navigates waiting room and recovery actions on mobile with real clicks", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          enumerateDevices: async () => [
            {
              deviceId: "audio-1",
              groupId: "group-1",
              kind: "audioinput",
              label: "Microfone de teste",
              toJSON: () => ({}),
            },
            {
              deviceId: "video-1",
              groupId: "group-1",
              kind: "videoinput",
              label: "Camera de teste",
              toJSON: () => ({}),
            },
          ],
          getUserMedia: async () => ({
            getTracks: () => [{ stop: () => undefined }],
          }),
        },
      });
    });

    let previewCount = 0;
    await page.route("**/api/zoom/video-session-access", async (route) => {
      const body = route.request().postDataJSON();

      if (body.intent === "preview") {
        previewCount += 1;
        await route.fulfill({
          body: JSON.stringify({
            data: {
              access: {
                allowed: previewCount > 1,
                availableFrom: "2026-07-26T12:45:00.000Z",
                availableUntil: "2026-07-26T14:00:00.000Z",
                reason: previewCount > 1 ? null : "THERAPIST_NOT_IN_SESSION",
                serverNow: "2026-07-26T12:46:00.000Z",
                videoSessionStatus: previewCount > 1 ? "ready" : "ready",
              },
            },
            ok: true,
          }),
          contentType: "application/json",
          status: 200,
        });
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          error: {
            code: "expired_token",
            message: "Token expirado.",
          },
          ok: false,
        }),
        contentType: "application/json",
        status: 401,
      });
    });

    await page.goto(`/app/encontros/${bookingId}`);

    await expect(
      page.getByText(/Aguardando o terapeuta iniciar/i),
    ).toBeVisible();
    await page.getByRole("button", { name: "Atualizar sala" }).click();
    await expect(
      page.getByRole("button", { name: "Entrar no encontro" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Entrar no encontro" }).click();
    await expect(page.getByText("Token expirado.")).toBeVisible();
    await page.getByRole("button", { name: "Revisar permissões" }).click();
    await expect(page.getByText(/Permissoes liberadas/i)).toBeVisible();

    await page.getByRole("button", { name: "Copiar referência" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/referencia/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /eyJ|sdkSecret|jwt-token/i,
    );
  });
});

test.describe("Zoom Video SDK participant browser isolation", () => {
  test("keeps therapist and patient auth isolated in separate contexts", async ({
    browser,
  }) => {
    const therapistContext = await browser.newContext();
    const patientContext = await browser.newContext();
    const therapistPage = await therapistContext.newPage();
    const patientPage = await patientContext.newPage();

    try {
      await loginAsTherapist(therapistPage);
      const patientCookiesBeforeLogin = await patientContext.cookies();
      expect(
        patientCookiesBeforeLogin.some((cookie) =>
          /sb-|supabase|auth/i.test(cookie.name),
        ),
      ).toBe(false);

      await patientPage.goto("/app");
      await expect(patientPage).toHaveURL(/\/cliente\/login/);

      await loginAsPatient(patientPage);
      await expect(therapistPage).toHaveURL(/\/terapeuta(?:\?.*)?$/);
    } finally {
      await patientContext.close();
      await therapistContext.close();
    }
  });
});

async function loginAsPatient(page: import("@playwright/test").Page) {
  await page.goto("/cliente/login");
  await page.getByLabel("E-mail").fill(patientEmail);
  await page.locator('input[name="password"]').fill(patientPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
}

async function loginAsTherapist(page: import("@playwright/test").Page) {
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.locator('input[name="password"]').fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}
