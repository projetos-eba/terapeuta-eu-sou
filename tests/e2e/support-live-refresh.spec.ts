import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isLocal = ["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname);
const fixturePassword = process.env.LOCAL_E2E_PASSWORD ?? "tes-mock-password";
const adminEmail =
  process.env.LOCAL_E2E_ADMIN_EMAIL ?? "admin.tes@example.test";
const therapistEmail =
  process.env.LOCAL_E2E_THERAPIST_EMAIL ?? "ana.oliveira@example.test";

test.skip(!isLocal, "Este cenário cria somente fixtures no Supabase local.");
test.use({ screenshot: "only-on-failure", trace: "retain-on-failure" });

test("local: suporte atualiza Admin e terapeuta ao vivo sem recarregamento manual", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const subject = `QA local — suporte ao vivo ${Date.now()}`;
  const publicReply = "A equipe TES está acompanhando esta solicitação.";
  const requesterReply = "Obrigada, preciso de mais uma orientação.";
  const internalNote = "QA local: registro interno isolado.";
  const therapistContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const therapistPage = await therapistContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    await Promise.all([
      loginAsTherapist(therapistPage, therapistContext),
      loginAsAdmin(adminPage, adminContext),
    ]);

    await adminPage.goto("/admin/suporte");
    await expect(
      adminPage.getByRole("heading", { name: "Inbox de atendimento" }),
    ).toBeVisible();

    await therapistPage.goto("/terapeuta/mensagens");
    await therapistPage.getByRole("button", { name: "Novo chamado" }).click();
    await therapistPage.getByLabel("Categoria").selectOption("outro");
    await therapistPage.getByRole("textbox", { name: "Assunto" }).fill(subject);
    await therapistPage
      .getByRole("textbox", { name: /Conte mais sobre o que aconteceu/ })
      .fill("Cenário local para validar atualização em tempo real.");
    await therapistPage.getByRole("button", { name: "Abrir chamado" }).click();
    await therapistPage.waitForURL(/\/terapeuta\/mensagens\/suporte\//);

    await expect(
      adminPage.getByRole("heading", { level: 3, name: subject }),
    ).toBeVisible({ timeout: 30_000 });
    await adminPage.getByRole("heading", { level: 3, name: subject }).click();
    await adminPage.waitForURL(/\/admin\/suporte\//);
    await adminPage
      .getByRole("button", { name: "Iniciar atendimento" })
      .click();
    await adminPage.getByLabel("Resposta pública").fill(publicReply);
    await adminPage.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(
      adminPage.getByText("Resposta enviada ao solicitante."),
    ).toBeVisible();

    await expect(
      therapistPage.getByText(publicReply, { exact: true }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      therapistPage.getByText("Aguardando sua resposta", { exact: true }),
    ).toBeVisible();

    await adminPage.goto("/admin/suporte");
    await therapistPage.getByLabel("Responder ao suporte").fill(requesterReply);
    await therapistPage
      .getByRole("button", { name: "Enviar resposta" })
      .click();
    await expect(
      therapistPage.getByText("Aguardando resposta do TES", { exact: true }),
    ).toBeVisible();
    await expect(
      adminPage.getByRole("heading", { level: 3 }).first(),
    ).toHaveText(subject, { timeout: 30_000 });

    await adminPage.getByRole("heading", { level: 3, name: subject }).click();
    await adminPage.getByLabel("Nota interna").fill(internalNote);
    await adminPage
      .getByRole("button", { name: "Salvar nota interna" })
      .click();
    await expect(adminPage.getByText("Nota interna salva.")).toBeVisible();
    await expect(
      therapistPage.getByText(internalNote, { exact: true }),
    ).not.toBeVisible();

    await therapistPage.setViewportSize({ height: 844, width: 390 });
    await expect
      .poll(() =>
        therapistPage.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
  } finally {
    await Promise.all([therapistContext.close(), adminContext.close()]);
  }
});

test("local: a Central marca conversas como lidas e mantém listas paginadas", async ({
  browser,
}) => {
  const therapistContext = await browser.newContext();
  const therapistPage = await therapistContext.newPage();

  try {
    await loginAsTherapist(therapistPage, therapistContext);
    await therapistPage.goto("/terapeuta/mensagens");

    await expect(
      therapistPage.getByRole("table", { name: "Tabela de conversas" }),
    ).toBeVisible();
    await expect(
      therapistPage.getByRole("navigation", { name: "Paginação de conversas" }),
    ).toBeVisible();
    await expect(
      therapistPage.getByRole("navigation", { name: "Paginação de chamados" }),
    ).toBeVisible();

    const unreadRow = therapistPage
      .getByRole("row")
      .filter({ has: therapistPage.getByLabel("Mensagem não lida") })
      .first();
    test.skip(
      (await unreadRow.count()) === 0,
      "O seed local interrompido não contém a conversa estruturada necessária para este clique.",
    );
    const titleButton = unreadRow
      .getByRole("button", { name: /Abrir / })
      .first();
    const title = await titleButton.getAttribute("aria-label");
    await expect(titleButton).toBeVisible();
    await unreadRow.getByRole("button", { name: "Ver mensagens" }).click();
    await expect(unreadRow.getByLabel("Mensagem não lida")).toHaveCount(0, {
      timeout: 15_000,
    });
    await therapistPage.getByRole("button", { name: "Fechar" }).click();
    await therapistPage.reload();
    await expect(
      therapistPage
        .getByRole("button", { name: title ?? /Abrir / })
        .locator("xpath=ancestor::article")
        .getByLabel("Mensagem não lida"),
    ).toHaveCount(0);
  } finally {
    await therapistContext.close();
  }
});

async function loginAsTherapist(page: Page, context: BrowserContext) {
  await context.addCookies([
    {
      name: "tes-e2e-context",
      sameSite: "Lax",
      url: baseUrl,
      value: "therapist",
    },
  ]);
  await page.goto("/terapeuta/login");
  await page.locator('input[name="email"]').fill(therapistEmail);
  await page.locator('input[name="password"]').fill(fixturePassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}

async function loginAsAdmin(page: Page, context: BrowserContext) {
  await context.addCookies([
    {
      name: "tes-e2e-context",
      sameSite: "Lax",
      url: baseUrl,
      value: "admin",
    },
  ]);
  await page.goto("/admin-login");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.locator('input[name="password"]').fill(fixturePassword);
  await page.getByRole("button", { name: "Entrar no Admin" }).click();
  await expect(page).toHaveURL(/\/admin(?:\?.*)?$/);
}
