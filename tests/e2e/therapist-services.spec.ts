import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";

test.describe("therapist services management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAna(page);
  });

  test("edits, activates, verifies public profile, and pauses a service", async ({
    page,
  }) => {
    const serviceTitle = "Constelação em rascunho";
    const updatedDescription = `Experiência simbólica revisada pelo E2E ${Date.now()}, sem diagnóstico ou promessa de resolução.`;

    await page.goto("/terapeuta/servicos");
    await expect(
      page.getByRole("heading", { level: 1, name: "Suas terapias" }),
    ).toBeVisible();
    await expect(page.getByText("Dicas TES")).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Abrir ações de ${serviceTitle}` }),
    ).toBeVisible();
    await ensureServicePaused(page, serviceTitle);

    await page
      .getByRole("button", { name: `Abrir ações de ${serviceTitle}` })
      .click();
    await page.getByRole("button", { name: "Editar serviço" }).click();
    await expect(
      page.getByRole("dialog", { name: "Editar serviço" }),
    ).toBeVisible();
    await page.getByLabel("Descrição").fill(updatedDescription);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText(updatedDescription)).toBeVisible();

    await page.getByRole("button", { name: `Ativar ${serviceTitle}` }).click();
    await page.getByRole("button", { name: "Ativar serviço" }).click();
    await expect(
      page.getByRole("button", { name: `Pausar ${serviceTitle}` }),
    ).toBeVisible();

    await page.goto("/terapeutas/ana-oliveira");
    await expect(
      page.getByRole("heading", { name: serviceTitle }),
    ).toBeVisible();

    await page.goto("/terapeuta/servicos");
    await page.getByRole("button", { name: `Pausar ${serviceTitle}` }).click();
    await page.getByRole("button", { name: "Pausar serviço" }).click();
    await expect(
      page.getByRole("button", { name: `Ativar ${serviceTitle}` }),
    ).toBeVisible();

    await page.goto("/terapeutas/ana-oliveira");
    await expect(page.getByRole("heading", { name: serviceTitle })).toHaveCount(
      0,
    );
  });

  test("keeps the services surface usable across responsive widths", async ({
    page,
  }) => {
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ height: 900, width });
      await page.goto("/terapeuta/servicos");

      await expect(
        page.getByRole("heading", { level: 1, name: "Suas terapias" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Novo serviço" }),
      ).toBeVisible();
      await expect(page.getByText("Dicas TES")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Abrir ações de/ }).first(),
      ).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((node) => {
          node.remove();
        });

        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(hasHorizontalOverflow).toBe(false);
    }
  });
});

async function loginAsAna(page: import("@playwright/test").Page) {
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.getByLabel("Senha").fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}

async function ensureServicePaused(
  page: import("@playwright/test").Page,
  serviceTitle: string,
) {
  const pauseButton = page.getByRole("button", {
    name: `Pausar ${serviceTitle}`,
  });
  if ((await pauseButton.count()) === 0) return;

  await pauseButton.click();
  await page.getByRole("button", { name: "Pausar serviço" }).click();
  await expect(
    page.getByRole("button", { name: `Ativar ${serviceTitle}` }),
  ).toBeVisible();
}
