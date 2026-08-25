import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

test.describe("admin dashboard", () => {
  test("loads aggregated overview and only links to implemented modules", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
      timeout: 30_000,
    });

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Catálogo e Match" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Operação" })).toBeVisible();
    await expect(
      page.getByText("Governança de produto, operação, flags").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Profissionais" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Clientes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Sessões" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Suporte" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Financeiro" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Assinaturas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Segurança" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Configurações" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Integrações" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { exact: true, name: "Relatórios" }),
    ).toHaveCount(0);

    await page
      .getByRole("link", { name: /Abrir módulo/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/terapias(?:\?.*)?$/);
  });

  test("reveals details when focusing an evolution chart point", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\?.*)?$/);
    await page.goto("/admin");

    const point = page.getByRole("img", {
      name: "Detalhes de Pacientes ativos: 41",
    });
    await point.locator('circle[aria-hidden="true"]').hover();
    const tooltip = page.locator("g.admin-dashboard-chart-tooltips > g").first();
    await expect(tooltip).toContainText("Pacientes ativos");
    await expect
      .poll(() => tooltip.evaluate((element) => getComputedStyle(element).opacity))
      .toBe("1");
  });
});
