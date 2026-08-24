import { expect, test } from "@playwright/test";

const patientPassword =
  process.env.PATIENT_MANAGEMENT_E2E_PASSWORD ?? "tes-mock-password";
const reschedulePatientEmail =
  process.env.PATIENT_RESCHEDULE_E2E_EMAIL ?? "paciente.rafael@example.test";
const rescheduleBookingId =
  process.env.PATIENT_RESCHEDULE_E2E_BOOKING_ID ??
  "f2000000-0000-4000-8000-000000000002";
const cancellationPatientEmail =
  process.env.PATIENT_CANCELLATION_E2E_EMAIL ?? "paciente.juliana@example.test";
const cancellationBookingId =
  process.env.PATIENT_CANCELLATION_E2E_BOOKING_ID ??
  "f2000000-0000-4000-8000-000000000004";

test.use({ screenshot: "on", trace: "on", video: "on" });

test.describe("patient encounter management", () => {
  test("keeps encounter detail readable and operable on desktop, tablet and mobile", async ({
    page,
  }, testInfo) => {
    await loginAsPatient(page, reschedulePatientEmail);
    await page.goto(`/app/encontros/${rescheduleBookingId}`);
    await expect(
      page.getByRole("heading", { name: "Detalhe do encontro" }),
    ).toBeVisible();

    for (const viewport of [
      { height: 900, label: "desktop", width: 1440 },
      { height: 768, label: "tablet", width: 1024 },
      { height: 844, label: "mobile", width: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(
        page.getByRole("heading", { name: "Detalhe do encontro" }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Seu encontro online" }),
      ).toBeVisible();

      const metrics = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
      await assertOverviewIdentityIsNotCompressed(page);

      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(
          `patient-encounter-detail-${viewport.label}.png`,
        ),
      });
    }
  });

  test("requests reschedule with a real click from the encounter detail", async ({
    page,
  }) => {
    const rescheduleRequests: unknown[] = [];

    await page.route("**/api/session/reschedule", async (route) => {
      rescheduleRequests.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: "application/json",
        status: 200,
      });
    });

    await loginAsPatient(page, reschedulePatientEmail);
    await page.goto(`/app/encontros/${rescheduleBookingId}`);

    const rescheduleButton = page.getByRole("button", {
      name: "Solicitar reagendamento",
    });
    await expect(rescheduleButton).toBeVisible();
    await expect(rescheduleButton).toBeEnabled();
    await rescheduleButton.click();

    await expect(
      page.getByRole("dialog", { name: "Solicitar reagendamento" }),
    ).toBeVisible();
    await page
      .getByLabel("Novo dia e horário")
      .fill(getFutureDatetimeLocalValue());
    await page
      .getByLabel("Motivo opcional")
      .fill("Preciso ajustar minha disponibilidade.");
    await page.getByRole("button", { name: "Enviar proposta" }).click();

    await expect
      .poll(() => rescheduleRequests.length)
      .toBeGreaterThanOrEqual(1);
    expect(rescheduleRequests[0]).toMatchObject({
      actorRole: "patient",
      command: {
        action: "request",
        bookingId: rescheduleBookingId,
        reason: "Preciso ajustar minha disponibilidade.",
      },
    });
  });

  test("shows cancellation impact and posts cancellation with a real click", async ({
    page,
  }) => {
    const cancellationRequests: unknown[] = [];

    await page.route("**/api/session/cancel", async (route) => {
      cancellationRequests.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: "application/json",
        status: 200,
      });
    });

    await loginAsPatient(page, cancellationPatientEmail);
    await page.goto(`/app/encontros/${cancellationBookingId}`);

    const cancelButton = page.getByRole("button", {
      name: "Cancelar encontro",
    });
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).toBeEnabled();
    await cancelButton.click();

    const cancellationDialog = page.getByRole("dialog", {
      name: "Cancelar encontro",
    });
    await expect(cancellationDialog).toBeVisible();
    await expect(
      cancellationDialog.getByText(
        /24h ou mais pode permitir reembolso integral/i,
      ),
    ).toBeVisible();
    await page
      .getByLabel("Motivo opcional")
      .fill("Preciso cancelar este horário.");
    await page.getByRole("button", { name: "Confirmar cancelamento" }).click();

    await expect
      .poll(() => cancellationRequests.length)
      .toBeGreaterThanOrEqual(1);
    expect(cancellationRequests[0]).toMatchObject({
      actorRole: "patient",
      bookingId: cancellationBookingId,
      reason: "Preciso cancelar este horário.",
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    });
  });
});

async function assertOverviewIdentityIsNotCompressed(
  page: import("@playwright/test").Page,
) {
  const metrics = await page.locator("section").evaluateAll((sections) => {
    const overview = sections.find(
      (section) =>
        section.querySelector("h2") !== null &&
        section.querySelector("img") !== null,
    );
    const title = overview?.querySelector("h2");

    return {
      found: Boolean(title),
      isHorizontallyClipped: title
        ? title.scrollWidth > title.clientWidth
        : false,
    };
  });

  expect(metrics.found).toBe(true);
  expect(metrics.isHorizontallyClipped).toBe(false);
}

async function loginAsPatient(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/cliente/login");
  await page.getByLabel("E-mail").fill(email);
  await page.locator('input[name="password"]').fill(patientPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
}

function getFutureDatetimeLocalValue() {
  const value = new Date(Date.now() + 72 * 60 * 60 * 1000);
  value.setMinutes(0, 0, 0);
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
