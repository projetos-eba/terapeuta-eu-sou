import { expect, test } from "@playwright/test";

const patientEmail =
  process.env.PATIENT_SCHEDULE_E2E_EMAIL ?? "paciente.ana@example.test";
const patientPassword =
  process.env.PATIENT_SCHEDULE_E2E_PASSWORD ?? "tes-mock-password";
const serviceId = "d1000000-0000-4000-8000-000000000002";

const viewports = [
  { height: 900, label: "desktop", width: 1440 },
  { height: 844, label: "mobile", width: 390 },
] as const;

for (const viewport of viewports) {
  test(`patient conflicts remain visible and are blocked on ${viewport.label}`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL: baseURL ?? "http://localhost:3000",
      recordVideo: { dir: testInfo.outputPath("video") },
      viewport,
    });
    const page = await context.newPage();
    const fixture = nextWednesdayFixture();
    const reservationPath =
      `/reserva?therapist=rafael-santos&service=${serviceId}` +
      `&duration=60&price=12000&date=${fixture.date}`;

    try {
      await page.goto("/cliente/login");
      await page.getByLabel("E-mail").fill(patientEmail);
      await page.locator('input[name="password"]').fill(patientPassword);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/app(?:\?.*)?$/);

      await page.goto(reservationPath);
      const conflictingSlot = page.getByRole("button", {
        name: "09:30, coincide com outro encontro seu",
      });
      await expect(conflictingSlot).toBeVisible();
      await expect(page.getByRole("link", { name: "09:30" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "10:30" })).toBeVisible();

      const urlBeforeConflict = page.url();
      await conflictingSlot.click();
      await expect(
        page.getByRole("heading", {
          name: "Você já tem um encontro nesse horário",
        }),
      ).toBeVisible();
      await expect(page).toHaveURL(urlBeforeConflict);
      await page
        .getByRole("button", { name: "Escolher outro horário" })
        .click();
      await expect(conflictingSlot).toBeFocused();

      await conflictingSlot.click();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("heading", {
          name: "Você já tem um encontro nesse horário",
        }),
      ).toHaveCount(0);
      await expect(conflictingSlot).toBeFocused();

      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`visible-conflict-${viewport.label}.png`),
      });

      await page.goto(
        `${reservationPath}&slot=${encodeURIComponent(fixture.startsAt)}&etapa=pagamento`,
      );
      await expect(
        page.getByRole("heading", {
          name: "Você já tem um encontro nesse horário",
        }),
      ).toBeVisible();
      await expect(page).toHaveURL(/etapa=momento/);

      const checkoutResponse = await page.request.post(
        "/api/public/reservation/checkout",
        {
          data: {
            action: "create",
            checkoutAttemptId:
              viewport.label === "desktop"
                ? "a1030000-0000-4000-8000-000000000301"
                : "a1030000-0000-4000-8000-000000000302",
            serviceId,
            sharedNote: null,
            startsAt: fixture.startsAt,
            termsAccepted: true,
          },
        },
      );
      expect(checkoutResponse.status()).toBe(409);
      await expect(checkoutResponse.json()).resolves.toMatchObject({
        code: "PATIENT_SCHEDULE_CONFLICT",
        ok: false,
      });

      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`direct-conflict-${viewport.label}.png`),
      });
    } finally {
      const video = page.video();
      await context.close();
      if (video) {
        await testInfo.attach(`video-${viewport.label}`, {
          contentType: "video/webm",
          path: await video.path(),
        });
      }
    }
  });
}

function nextWednesdayFixture() {
  const dateInSaoPaulo = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(new Date());
  const noonUtc = new Date(`${dateInSaoPaulo}T12:00:00.000Z`);
  // Match local-e2e-fixtures.sql: Monday of this week + nine days.
  const daysSinceMonday = (noonUtc.getUTCDay() + 6) % 7;
  noonUtc.setUTCDate(noonUtc.getUTCDate() - daysSinceMonday + 9);
  const date = noonUtc.toISOString().slice(0, 10);
  return { date, startsAt: `${date}T12:30:00.000Z` };
}
