import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";

test.describe("therapist Sessions operational surface", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAna(page);
  });

  test("keeps operational sessions separate from Metrics insights", async ({
    page,
  }) => {
    await page.goto("/terapeuta/sessoes");

    await expect(
      page.getByRole("heading", { level: 1, name: "Sessões" }),
    ).toBeVisible();
    await expect(page.locator('select[name="period"]')).toHaveValue("30");
    await expect(
      page.getByRole("heading", { name: "Taxa de presença" }),
    ).toBeVisible();
    await expect(page.getByText(/Horário mais agendado/i)).toHaveCount(0);
    await expect(page.getByText(/Terapia mais realizada/i)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Sessões que irão acontecer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sessões que já passaram" }),
    ).toBeVisible();
    const sessionCardTitles = await page
      .locator(
        'section[aria-label="Lista de sessões"] > section[aria-label="Sessões que irão acontecer"] h2, section[aria-label="Lista de sessões"] > section[aria-label="Sessões que já passaram"] h2',
      )
      .allTextContents();
    expect(sessionCardTitles.slice(0, 2)).toEqual([
      "Sessões que irão acontecer",
      "Sessões que já passaram",
    ]);
    await expect(
      page.getByRole("cell", { name: "Processando" }).first(),
    ).toBeVisible();

    await page.locator('select[name="period"]').selectOption("7");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/period=7/);
    await expect(
      page.getByRole("heading", { name: "Sessões que já passaram" }),
    ).toBeVisible();

    await page.locator('select[name="period"]').selectOption("90");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/period=90/);
    await expect(page.getByText(/sessões carregadas/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Taxa de presença" }),
    ).toBeVisible();
  });

  test("does not overflow across desktop, tablet and mobile", async ({
    page,
  }) => {
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ height: 920, width });
      await page.goto("/terapeuta/sessoes");
      await expect(
        page.getByRole("heading", { level: 1, name: "Sessões" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Taxa de presença" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Sessões que irão acontecer" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Sessões que já passaram" }),
      ).toBeVisible();
      if (width >= 1280) {
        await expect(page.locator("table").first()).toBeVisible();
      } else {
        await expect(page.locator("table").first()).toBeHidden();
      }
      await expectNoHorizontalPageOverflow(page);
    }
  });
});

test("public therapist profile renders every eligible service and public themes", async ({
  page,
}) => {
  await page.goto("/terapeutas/ana-oliveira");

  await expect(
    page.getByRole("heading", { level: 2, name: "Vivências e terapias" }),
  ).toBeVisible();
  const servicesSection = page.locator("section").filter({
    has: page.getByRole("heading", {
      level: 2,
      name: "Vivências e terapias",
    }),
  });
  await expect(
    page.getByRole("heading", { level: 3, name: "Reiki" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Tarô" }),
  ).toBeVisible();
  await expect(
    servicesSection.getByRole("link", { name: "Agendar" }),
  ).toHaveCount(2);
  await expect(
    servicesSection.getByText("Autoconhecimento", { exact: true }),
  ).toHaveCount(2);
  await expect(
    servicesSection.getByText("Equilíbrio emocional", { exact: true }),
  ).toBeVisible();
  await expect(
    servicesSection.getByText("Clareza nas escolhas", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aromaterapia" })).toHaveCount(
    0,
  );
});

async function loginAsAna(page: import("@playwright/test").Page) {
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.locator('input[name="password"]').fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}

async function expectNoHorizontalPageOverflow(
  page: import("@playwright/test").Page,
) {
  const hasOverflow = await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
    return document.documentElement.scrollWidth > window.innerWidth + 1;
  });
  expect(hasOverflow).toBe(false);
}
