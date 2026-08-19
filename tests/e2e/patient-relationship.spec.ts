import { expect, test } from "@playwright/test";

const patientEmail =
  process.env.PATIENT_RELATIONSHIP_E2E_EMAIL ?? "carlos.paciente@example.test";
const patientPassword =
  process.env.PATIENT_RELATIONSHIP_E2E_PASSWORD ?? "tes-mock-password";
const therapistSlug =
  process.env.PATIENT_RELATIONSHIP_E2E_THERAPIST_SLUG ?? "ana-oliveira";

test.use({ screenshot: "on", trace: "on", video: "on" });

test.describe("patient relationship flows", () => {
  test("requires a patient login before a public profile can be favorited", async ({
    page,
  }) => {
    await page.goto(`/terapeutas/${therapistSlug}`);
    await page
      .getByRole("button", { name: /Adicionar aos favoritos de/i })
      .click();

    await expect(page).toHaveURL(
      new RegExp(
        `/cliente/login\\?next=%2Fterapeutas%2F${therapistSlug}(?:%3F[^&]+)?$`,
      ),
    );
  });

  test("favorites a public therapist, syncs the patient panel and removes it", async ({
    page,
  }) => {
    await loginAsPatient(page);
    await page.goto(`/terapeutas/${therapistSlug}`);

    const therapistName = await page
      .getByRole("heading", { level: 1 })
      .innerText();
    const favoriteButton = page.getByRole("button", {
      name: new RegExp(
        `(?:Adicionar aos|Remover dos) favoritos de ${escapeRegExp(therapistName)}`,
        "i",
      ),
    });

    if ((await favoriteButton.getAttribute("aria-pressed")) === "true") {
      await favoriteButton.click();
      await expect(favoriteButton).toHaveAttribute("aria-pressed", "false");
    }

    await favoriteButton.click();
    await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/app/favoritos/terapeutas");
    const favoriteCard = page
      .getByRole("heading", { level: 2, name: therapistName })
      .locator("xpath=ancestor::article");
    await expect(favoriteCard).toBeVisible();

    await favoriteCard
      .getByRole("button", { name: "Remover favorito" })
      .click();
    await expect(favoriteCard).toHaveCount(0);
  });

  test("shares only the canonical public profile URL", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async ({ url }: { url: string }) => {
          Reflect.set(window, "__tesSharedProfileUrl", url);
        },
      });
    });
    await page.goto(`/terapeutas/${therapistSlug}?source=e2e`);
    await page.getByRole("button", { name: "Compartilhar perfil" }).click();

    const sharedUrl = await page.evaluate(() =>
      Reflect.get(window, "__tesSharedProfileUrl"),
    );
    expect(sharedUrl).toBe(
      new URL(`/terapeutas/${therapistSlug}`, page.url()).toString(),
    );
  });

  test("opens notifications from shell and marks platform notices as read", async ({
    page,
  }) => {
    const markReadRequests: unknown[] = [];

    await loginAsPatient(page);
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
