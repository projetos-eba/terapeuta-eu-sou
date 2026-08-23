import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

const financeRoutes = [
  {
    detailHeadings: [
      "Detalhes do financeiro",
      "Composição dos valores",
      "Movimentações recentes",
    ],
    contextualHeading: null,
    path: "/admin/pagamentos",
    rowsTitle: "Transações e repasses",
    title: "Financeiro",
  },
  {
    detailHeadings: ["Assinatura", "Eventos recentes"],
    contextualHeading: "Indicadores complementares",
    path: "/admin/assinaturas",
    rowsTitle: "Assinaturas recentes",
    title: "Assinaturas",
  },
  {
    detailHeadings: [],
    contextualHeading: "Guardrails financeiros",
    path: "/admin/relatorios",
    rowsTitle: "Relatórios disponíveis",
    title: "Relatórios",
  },
] as const;

const chunkErrorPattern = /ChunkLoadError|Loading chunk .* failed/i;

test.describe("admin finance modules", () => {
  test("loads finance, subscriptions and reports with safe read-only surfaces", async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
      timeout: 30_000,
    });

    for (const {
      contextualHeading,
      detailHeadings,
      path,
      rowsTitle,
      title,
    } of financeRoutes) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      await expect(page.getByText(chunkErrorPattern)).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: rowsTitle }),
      ).toBeVisible();

      if (contextualHeading) {
        await expect(
          page.getByRole("heading", { name: contextualHeading }),
        ).toBeVisible();
      }

      if (path !== "/admin/relatorios") {
        const detailLinks = page.getByRole("link", { name: "Ver detalhes" });

        if ((await detailLinks.count()) > 0) {
          await detailLinks.first().click();
          await expect(page).toHaveURL(new RegExp(`${path}/[0-9a-f-]+$`));
          await expect(page.getByText(chunkErrorPattern)).toHaveCount(0);

          for (const heading of detailHeadings) {
            await expect(
              page.getByRole("heading", { name: heading }),
            ).toBeVisible();
          }

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
    expect(
      runtimeErrors.filter((message) => chunkErrorPattern.test(message)),
    ).toEqual([]);
  });
});
