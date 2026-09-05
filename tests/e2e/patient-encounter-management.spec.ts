import { expect, test } from "@playwright/test";

const patientPassword =
  process.env.PATIENT_MANAGEMENT_E2E_PASSWORD ?? "tes-mock-password";
const reschedulePatientEmail =
  process.env.PATIENT_RESCHEDULE_E2E_EMAIL ?? "paciente.rafael@example.test";
const rescheduleBookingId =
  process.env.PATIENT_RESCHEDULE_E2E_BOOKING_ID;
const cancellationPatientEmail =
  process.env.PATIENT_CANCELLATION_E2E_EMAIL ?? "paciente.rafael@example.test";
const cancellationBookingId =
  process.env.PATIENT_CANCELLATION_E2E_BOOKING_ID;

test.use({ screenshot: "on", trace: "on", video: "on" });

test.describe("patient encounter management", () => {
  test("keeps encounter detail readable and operable on desktop, tablet and mobile", async ({
    page,
  }, testInfo) => {
    await loginAsPatient(page, reschedulePatientEmail);
    const bookingId = await findManageableBookingId(page, rescheduleBookingId);
    await page.goto(`/app/encontros/${bookingId}`);
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

    await page.route(
      "**/api/session/reschedule/availability?**",
      async (route) => {
        const bookingId = new URL(route.request().url()).searchParams.get(
          "bookingId",
        );
        await route.fulfill({
          body: JSON.stringify({
            ok: true,
            data: availabilityFixture(bookingId ?? "unknown-booking"),
          }),
          contentType: "application/json",
          status: 200,
        });
      },
    );

    await page.route("**/api/session/reschedule", async (route) => {
      rescheduleRequests.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: "application/json",
        status: 200,
      });
    });

    await loginAsPatient(page, reschedulePatientEmail);
    const bookingId = await findManageableBookingId(page, rescheduleBookingId);
    await page.goto(`/app/encontros/${bookingId}`);

    const rescheduleButton = page.getByRole("button", {
      name: "Solicitar reagendamento",
    });
    await expect(rescheduleButton).toBeVisible();
    await expect(rescheduleButton).toBeEnabled();
    await rescheduleButton.click();

    await expect(
      page.getByRole("dialog", { name: "Solicitar reagendamento" }),
    ).toBeVisible();
    await expect(page.getByText(/Terapia contratada/)).toBeVisible();
    await page.getByRole("button", { name: "10:00" }).click();
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
        bookingId,
        reason: "Preciso ajustar minha disponibilidade.",
      },
    });
  });

  test("shows cancellation impact and posts cancellation with a real click", async ({
    page,
  }) => {
    const cancellationRequests: unknown[] = [];

    await page.route(
      "**/api/session/reschedule/availability?**",
      async (route) => {
        const bookingId = new URL(route.request().url()).searchParams.get(
          "bookingId",
        );
        await route.fulfill({
          body: JSON.stringify({
            ok: true,
            data: availabilityFixture(bookingId ?? "unknown-booking"),
          }),
          contentType: "application/json",
          status: 200,
        });
      },
    );

    await page.route("**/api/session/cancel", async (route) => {
      cancellationRequests.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: "application/json",
        status: 200,
      });
    });

    await loginAsPatient(page, cancellationPatientEmail);
    const bookingId = await findManageableBookingId(page, cancellationBookingId);
    await page.goto(`/app/encontros/${bookingId}`);

    const cancelButton = page.getByRole("button", {
      name: "Cancelar encontro",
    });
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).toBeEnabled();
    await cancelButton.click();

    const retentionDialog = page.getByRole("dialog", {
      name: "Antes de cancelar",
    });
    await expect(retentionDialog).toBeVisible();
    await retentionDialog
      .getByRole("button", { name: "Continuar com o cancelamento" })
      .click();
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
      .getByLabel(/Motivo\s+do cancelamento/)
      .fill("Preciso cancelar este horário.");
    await page.getByRole("button", { name: "Confirmar cancelamento" }).click();

    await expect
      .poll(() => cancellationRequests.length)
      .toBeGreaterThanOrEqual(1);
    expect(cancellationRequests[0]).toMatchObject({
      actorRole: "patient",
      bookingId,
      userReason: "Preciso cancelar este horário.",
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

async function findManageableBookingId(
  page: import("@playwright/test").Page,
  preferredBookingId?: string,
) {
  if (preferredBookingId) return preferredBookingId;

  await page.goto("/app");
  const detailsLink = page.getByRole("link", { name: "Ver detalhes" }).first();
  await expect(detailsLink).toBeVisible();
  const href = await detailsLink.getAttribute("href");
  const bookingId = href?.match(/\/app\/encontros\/([^/?#]+)/)?.[1];
  expect(bookingId).toBeTruthy();
  return bookingId!;
}

function availabilityFixture(bookingId: string) {
  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  startsAt.setUTCHours(13, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);
  return {
    booking: { id: bookingId, startsAt: startsAt.toISOString(), version: 1 },
    horizonEndsAt: new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    service: {
      currency: "BRL",
      durationMinutes: 50,
      id: "d1000000-0000-4000-8000-000000000001",
      priceCents: 12300,
      therapyName: "Reiki",
      title: "Reiki online",
    },
    slots: [{ endsAt: endsAt.toISOString(), startsAt: startsAt.toISOString() }],
    timezone: "America/Sao_Paulo",
  };
}
