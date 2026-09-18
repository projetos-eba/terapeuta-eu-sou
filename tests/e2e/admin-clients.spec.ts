import { expect, test } from "@playwright/test";

test("Clientes: responsive indicators, details and cancellation of suspension confirmation", async ({
  page,
  baseURL,
}, testInfo) => {
  // The verification must remain local and must never submit an account mutation.
  expect(new URL(baseURL ?? "http://localhost:3000").hostname).toMatch(
    /^(localhost|127\.0\.0\.1)$/,
  );
  await page.goto("/admin-login");
  await page
    .getByLabel("E-mail")
    .fill(process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test");
  await page
    .locator('input[name="password"]')
    .fill(process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password");
  await page.getByRole("button", { name: "Entrar no Admin" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
    timeout: 30_000,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/pacientes");
  const activeRow = page
    .getByRole("row")
    .filter({ has: page.getByText("Ativo", { exact: true }) })
    .first();
  const detailHref = await activeRow
    .getByRole("link", { name: /Ver detalhes de/ })
    .getAttribute("href");
  expect(detailHref).toMatch(/^\/admin\/pacientes\//);
  let mutations = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/admin/operations"
    )
      mutations += 1;
  });

  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/pacientes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Clientes", exact: true }),
    ).toBeVisible();
    const indicators = page.getByRole("region", {
      name: "Indicadores de clientes",
    });
    for (const label of [
      "Total de clientes",
      "Novos cadastros",
      "Contas ativas",
      "Clientes suspensos",
    ]) {
      await expect(indicators.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("combobox", { name: "Filtrar por status" }),
    ).toContainText("Suspensos");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`clients-list-${width}.png`),
      fullPage: true,
    });

    await page.goto(detailHref!);
    await expect(
      page.getByRole("heading", { level: 1, name: "Detalhes do cliente" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Dados e contato", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Na plataforma desde", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Cadastro da plataforma", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Conta vinculada", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`clients-detail-${width}.png`),
      fullPage: true,
    });
    if (
      (await page
        .getByRole("button", { name: "Suspender novos agendamentos" })
        .count()) === 0
    ) {
      await expect(
        page.getByText(
          "A gestão de agendamentos está indisponível no momento.",
        ),
      ).toBeVisible();
      continue;
    }
    await page
      .getByRole("textbox", { name: "Motivo" })
      .fill("Verificação visual sem executar suspensão");
    await page
      .getByRole("button", { name: "Suspender novos agendamentos" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Suspender novos agendamentos",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        /Login, suporte e sessões já contratadas continuarão disponíveis/,
      ),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`clients-confirmation-${width}.png`),
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(mutations).toBe(0);
});

test("Clientes redirects an unauthenticated session to Admin login", async ({
  page,
}) => {
  await page.goto("/admin/pacientes");
  await expect(page).toHaveURL(/\/admin-login(?:\?|$)/);
});
