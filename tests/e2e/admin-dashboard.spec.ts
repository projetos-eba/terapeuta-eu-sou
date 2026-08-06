import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

test.describe("admin dashboard", () => {
  test("loads aggregated overview and only links to implemented modules", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.getByLabel("Senha").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/);

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Catálogo e Match" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Operação" })).toBeVisible();
    await expect(
      page.getByText("Contrato dedicado pendente.").first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Profissionais" })).toHaveCount(
      0,
    );

    await page
      .getByRole("link", { name: /Abrir módulo/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/terapias(?:\?.*)?$/);
  });
});
