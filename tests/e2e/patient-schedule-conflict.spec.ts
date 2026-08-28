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
  test(`patient conflicts are hidden and blocked on ${viewport.label}`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL: baseURL ?? "http://localhost:3000",
      recordVideo: { dir: testInfo.outputPath("video") },
      viewport,
    });
    const page = await context.newPage();
    const fixture = nextTuesdayFixture();
    const reservationPath =
      `/reserva?therapist=rafael-santos&service=${serviceId}` +
      `&duration=60&price=17000&date=${fixture.date}`;

    try {
      await page.goto("/cliente/login");
      await page.getByLabel("E-mail").fill(patientEmail);
      await page.locator('input[name="password"]').fill(patientPassword);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/app(?:\?.*)?$/);

      await page.goto(reservationPath);
      await expect(
        page.getByText(
          "Horários que coincidem com seus encontros atuais não são exibidos.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "18:30" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "19:30" })).toBeVisible();

      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`filtered-${viewport.label}.png`),
      });

      await page.goto(
        `${reservationPath}&slot=${encodeURIComponent(fixture.startsAt)}&etapa=pagamento`,
      );
      await expect(
        page.getByText(
          "Você já tem outro encontro nesse horário. Escolha outro momento.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Preparar meu encontro" }).first(),
      ).toBeDisabled();

      const checkoutResponse = await page.request.post(
        "/api/public/reservation/checkout",
        {
          data: {
            checkoutAttemptId:
              viewport.label === "desktop"
                ? "a1030000-0000-4000-8000-000000000301"
                : "a1030000-0000-4000-8000-000000000302",
            serviceId,
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

function nextTuesdayFixture() {
  const dateInSaoPaulo = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(new Date());
  const noonUtc = new Date(`${dateInSaoPaulo}T12:00:00.000Z`);
  const daysUntilTuesday =
    noonUtc.getUTCDay() === 2 ? 7 : (9 - noonUtc.getUTCDay()) % 7;
  noonUtc.setUTCDate(noonUtc.getUTCDate() + daysUntilTuesday);
  const date = noonUtc.toISOString().slice(0, 10);
  return { date, startsAt: `${date}T21:30:00.000Z` };
}
