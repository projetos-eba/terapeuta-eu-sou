import { expect, test } from "@playwright/test";

test.describe("therapist signup plan selection", () => {
  test("opens plan pre-step from therapist login and continues to selected signup", async ({
    page,
  }) => {
    await page.goto("/terapeuta/login");

    await page.getByRole("link", { name: "Criar cadastro inicial" }).click();

    await expect(
      page.getByRole("heading", { name: "Escolha seu plano" }),
    ).toBeVisible();

    await page
      .getByRole("link", { exact: true, name: "Selecionar Premium" })
      .click();

    await expect(page).toHaveURL(/\/terapeuta\/cadastro\?plan=premium/);
    await expect(page.getByText("Plano selecionado:")).toBeVisible();
    await expect(page.getByText("Premium", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toBeVisible();
  });
});
