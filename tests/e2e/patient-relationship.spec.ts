import { expect, test } from "@playwright/test";

const patientEmail =
  process.env.PATIENT_RELATIONSHIP_E2E_EMAIL ?? "carlos.paciente@example.test";
const patientPassword =
  process.env.PATIENT_RELATIONSHIP_E2E_PASSWORD ?? "tes-mock-password";

test.use({ screenshot: "on", trace: "on", video: "on" });

test.describe("patient relationship flows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPatient(page);
  });

  test("favorites a public therapist profile with a real click", async ({
    page,
  }) => {
    const favoriteRequests: unknown[] = [];

    await page.route("**/api/patient/favorite-therapists", async (route) => {
      favoriteRequests.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/terapeutas/ana-oliveira");

    const favoriteButton = page.getByRole("button", {
      name: /Adicionar aos favoritos de/i,
    });
    await expect(favoriteButton).toBeVisible();
    await favoriteButton.click();

    await expect.poll(() => favoriteRequests.length).toBeGreaterThanOrEqual(1);
    expect(favoriteRequests[0]).toMatchObject({
      therapistProfileId: expect.any(String),
    });
    await expect(
      page.getByRole("button", { name: /Remover dos favoritos de/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("opens notifications from shell and marks platform notices as read", async ({
    page,
  }) => {
    const markReadRequests: unknown[] = [];

    await page.route("**/api/notifications/mark-read", async (route) => {
      markReadRequests.push(route.request().postDataJSON());
      await route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/app");
    await page
      .getByRole("link", { name: /Notificações, \d+ não lida/ })
      .click();
    await expect(page).toHaveURL(/\/app\/mensagens\?context=notificacoes/);

    const markReadButton = page.getByRole("button", {
      name: "Marcar avisos como lidos",
    });
    await expect(markReadButton).toBeVisible();
    await expect(markReadButton).toBeEnabled();
    await markReadButton.click();

    await expect.poll(() => markReadRequests.length).toBeGreaterThanOrEqual(1);
    expect(markReadRequests[0]).toMatchObject({ markAll: true });
  });
});

async function loginAsPatient(page: import("@playwright/test").Page) {
  await page.goto("/cliente/login");
  await page.getByLabel("E-mail").fill(patientEmail);
  await page.getByLabel("Senha").fill(patientPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
}
