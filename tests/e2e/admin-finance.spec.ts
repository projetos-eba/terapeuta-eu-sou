import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

const financeRoutes = [
  ["/admin/pagamentos", "Financeiro", "Pagamentos recentes"],
  ["/admin/assinaturas", "Assinaturas", "Assinaturas recentes"],
  ["/admin/relatorios", "Relatórios", "Relatórios disponíveis"],
] as const;

test.describe("admin finance modules", () => {
  test("loads finance, subscriptions and reports with safe read-only surfaces", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.getByLabel("Senha").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
      timeout: 30_000,
    });

    for (const [path, title, rowsTitle] of financeRoutes) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: rowsTitle })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Guardrails financeiros" }),
      ).toBeVisible();

      if (path !== "/admin/relatorios") {
        const detailLinks = page.getByRole("link", { name: "Ver detalhes" });

        if ((await detailLinks.count()) > 0) {
          await detailLinks.first().click();
          await expect(page).toHaveURL(new RegExp(`${path}/[0-9a-f-]+$`));
          await expect(
            page.getByRole("heading", { name: "Segurança financeira" }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", { name: "Eventos recentes" }),
          ).toBeVisible();
          await page.getByRole("link", { name: "Voltar" }).click();
          await expect(page).toHaveURL(new RegExp(`${path}(?:\\?.*)?$`));
        }
      }
    }

    await page.goto("/admin");
    await expect(
      page.getByRole("link", { exact: true, name: "Financeiro" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Assinaturas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Relatórios" }),
    ).toHaveCount(0);

    const content = await page.content();
    expect(content).not.toContain("stripe_payment_intent_id");
    expect(content).not.toContain("stripe_checkout_session_id");
    expect(content).not.toContain("stripe_subscription_id");
    expect(content).not.toContain("hosted_invoice_url");
    expect(content).not.toContain("invoice_pdf");
    expect(content).not.toContain("payload_sanitized");
  });
});
