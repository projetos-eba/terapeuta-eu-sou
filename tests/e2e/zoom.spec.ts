import { expect, test } from "@playwright/test";

const patientEmail =
  process.env.PATIENT_E2E_EMAIL ?? "carlos.paciente@example.test";
const patientPassword = process.env.PATIENT_E2E_PASSWORD ?? "tes-mock-password";
const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";
const bookingId =
  process.env.ZOOM_E2E_BOOKING_ID ?? "94000000-0000-4000-8000-000000000021";

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
      accessRequests.push(request.postDataJSON());
      await route.fulfill({
        contentType: "application/json",
        status: 423,
        body: JSON.stringify({
          error: {
            code: "video_session_not_ready",
            message: "A sala ainda esta em preparacao.",
          },
          ok: false,
        }),
      });
    });

    await page.goto(`/app/encontros/${bookingId}`);

    await expect(page.getByLabel("Sala de video")).toBeVisible();
    await page.getByRole("button", { name: "Entrar na sessao" }).click();

    await expect(
      page.getByText("A sala ainda esta em preparacao."),
    ).toBeVisible();
    await expect.poll(() => accessRequests.length).toBe(1);
    expect(accessRequests[0]).toMatchObject({
      bookingId,
      intent: "join",
    });
    await expect(page.locator("body")).not.toContainText(
      /eyJ|sdkSecret|token/i,
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
  await page.getByLabel("Senha").fill(patientPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
}

async function loginAsTherapist(page: import("@playwright/test").Page) {
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.getByLabel("Senha").fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}
