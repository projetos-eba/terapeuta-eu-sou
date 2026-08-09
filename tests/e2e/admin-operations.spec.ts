import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

const operationRoutes = [
  ["/admin/profissionais", "Profissionais"],
  ["/admin/profissionais/verificacoes", "Verificações"],
  ["/admin/pacientes", "Clientes"],
  ["/admin/sessoes", "Sessões"],
  ["/admin/suporte", "Suporte"],
  ["/admin/avaliacoes", "Avaliações"],
] as const;

test.describe("admin operation modules", () => {
  test("loads people, operation and moderation routes with safe list payloads", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.getByLabel("Senha").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin\/terapias(?:\?.*)?$/);

    for (const [path, title] of operationRoutes) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Registros recentes" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Guardrails" })).toBeVisible();
    }

    await page.goto("/admin");
    await expect(
      page.getByRole("link", { exact: true, name: "Profissionais" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Verificações" }),
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
      page.getByRole("link", { exact: true, name: "Avaliações" }),
    ).toBeVisible();

    const content = await page.content();
    expect(content).not.toContain("meeting_url");
    expect(content).not.toContain("documents_metadata");
    expect(content).not.toContain("diagnostic_context");
  });
});
