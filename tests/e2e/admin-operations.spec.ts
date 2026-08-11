import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

const operationRoutes = [
  ["/admin/profissionais", "Profissionais", "Lista de profissionais", false],
  [
    "/admin/profissionais/verificacoes",
    "Verificações de profissionais",
    "Fila de revisão",
    false,
  ],
  ["/admin/pacientes", "Clientes", "Base de clientes", false],
  ["/admin/sessoes", "Sessões", "Agenda de sessões", false],
  ["/admin/suporte", "Suporte", "Fila de atendimento", false],
  ["/admin/avaliacoes", "Avaliações", "Registros recentes", true],
] as const;

test.describe("admin operation modules", () => {
  test("loads people, operation and moderation routes with safe list payloads", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.getByLabel("Senha").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
      timeout: 30_000,
    });

    for (const [path, title, rowsTitle, hasGuardrails] of operationRoutes) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: title }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: rowsTitle }),
      ).toBeVisible();

      if (hasGuardrails) {
        await expect(
          page.getByRole("heading", { name: "Guardrails" }),
        ).toBeVisible();
      }
    }

    await page.goto("/admin/sessoes");
    await page
      .getByRole("link", { name: "Ver detalhes do registro" })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Detalhes da sessão" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sala online" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Participação na sala" }),
    ).toBeVisible();

    const sessionDetail = await page.locator("body").innerText();
    expect(sessionDetail).not.toMatch(
      /provider_session_id|session_name|participant_correlation_key|video_session_control_jobs/i,
    );

    await page.goto("/admin");
    await expect(
      page.getByRole("link", { exact: true, name: "Profissionais" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Expandir subseções de Profissionais" })
      .click();
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

  test("keeps catalog, matching and settings clear and responsive", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.getByLabel("Senha").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
      timeout: 30_000,
    });

    const routes = [
      ["/admin/terapias", "Terapias", "Como o catálogo funciona"],
      ["/admin/matching", "Match", "Regras ativas"],
      ["/admin/configuracoes", "Configurações", "Proteção das configurações"],
    ] as const;

    for (const viewport of [
      { height: 900, width: 1440 },
      { height: 900, width: 430 },
    ]) {
      await page.setViewportSize(viewport);

      for (const [path, title, supportingTitle] of routes) {
        await page.goto(path);
        await expect(
          page.getByRole("heading", { level: 1, name: title }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: supportingTitle }),
        ).toBeVisible();

        const hasHorizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(hasHorizontalOverflow).toBe(false);

        const content = await page.locator("body").innerText();
        expect(content).not.toContain("Fonte:");
        expect(content).not.toContain("server-side");
        expect(content).not.toContain("therapist_services");
      }
    }
  });
});
