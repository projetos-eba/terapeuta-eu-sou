import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

const enabledAdminRoutes = [
  ["/admin", "Visão geral"],
  ["/admin/profissionais", "Profissionais"],
  ["/admin/profissionais/verificacoes", "Verificações"],
  ["/admin/pacientes", "Clientes"],
  ["/admin/sessoes", "Sessões"],
  ["/admin/suporte", "Suporte"],
  ["/admin/avaliacoes", "Avaliações"],
  ["/admin/pagamentos", "Financeiro"],
  ["/admin/assinaturas", "Assinaturas"],
  ["/admin/terapias", "Terapias"],
  ["/admin/matching", "Match"],
  ["/admin/integracoes", "Integrações"],
  ["/admin/seguranca", "Segurança"],
  ["/admin/relatorios", "Relatórios"],
  ["/admin/configuracoes", "Configurações"],
] as const;

test.describe("admin release navigation", () => {
  test("opens every enabled admin route without dead links or secret values", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.getByLabel("Senha").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
      timeout: 30_000,
    });

    for (const [path, heading] of enabledAdminRoutes) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
    }

    await page.goto("/admin/configuracoes");
    await expect(page.getByText("Política de secrets")).toBeVisible();
    await expect(page.getByText("Checklist de release")).toBeVisible();

    const content = await page.content();
    expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(content).not.toContain("STRIPE_SECRET_KEY=");
    expect(content).not.toContain("ZOOM_VIDEO_SDK_SECRET=");
    expect(content).not.toContain("EMAIL_SERVER_API_KEY=");
  });
});
