import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type Persona = {
  email: string;
  expectedPath: string;
  loginPath: string;
  password: string;
  storageValue: string;
  submitLabel: string;
};

const baseUrl = process.env.PLAYWRIGHT_HML_BASE_URL?.trim() ?? "";
const password = process.env.PLAYWRIGHT_HML_PASSWORD ?? "";
const therapistEmail = process.env.PLAYWRIGHT_HML_THERAPIST_EMAIL?.trim() ?? "";
const adminEmail = process.env.PLAYWRIGHT_HML_ADMIN_EMAIL?.trim() ?? "";
const configured = Boolean(baseUrl && password && therapistEmail && adminEmail);

test.skip(
  !configured,
  "Requer URL HML com share e credenciais QA efêmeras de terapeuta/Admin.",
);
test.use({ screenshot: "only-on-failure", trace: "retain-on-failure" });

test("HML: terapeuta e Admin mantêm uma thread de suporte isolada", async ({
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const hml = assertHmlShareUrl(baseUrl);
  const subject = `QA HML — repasse ${Date.now()}`;
  const therapistContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const therapistPage = await therapistContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    await login(therapistPage, therapistContext, hml, {
      email: therapistEmail,
      expectedPath: "/terapeuta",
      loginPath: "/terapeuta/login",
      password,
      storageValue: "therapist",
      submitLabel: "Entrar como terapeuta",
    });
    await login(adminPage, adminContext, hml, {
      email: adminEmail,
      expectedPath: "/admin",
      loginPath: "/admin-login",
      password,
      storageValue: "admin",
      submitLabel: "Entrar no Admin",
    });

    await therapistPage.goto(withShare(hml, "/terapeuta/mensagens"));
    await expect(
      therapistPage.getByRole("heading", { name: "Suporte TES" }),
    ).toBeVisible();
    // A primeira qualificação cobriu o empty state. Execuções seguintes mantêm
    // os chamados QA anteriores para preservar a rastreabilidade em HML.

    await therapistPage.getByRole("button", { name: "Novo chamado" }).click();
    await therapistPage
      .getByLabel("Categoria")
      .selectOption("financeiro_repasses");
    await therapistPage
      .getByRole("textbox", { name: "Assunto", exact: true })
      .fill(subject);
    await therapistPage
      .getByRole("textbox", { name: /Conte mais sobre o que aconteceu/ })
      .fill("Cenário controlado de qualificação do suporte TES.");
    await therapistPage.getByRole("button", { name: "Abrir chamado" }).click();
    await therapistPage.waitForURL(/\/terapeuta\/mensagens\/suporte\//);

    const ticketId = ticketIdFromUrl(therapistPage.url());
    await expect(
      therapistPage.getByText(
        `Protocolo ${ticketId.slice(0, 8).toUpperCase()}`,
      ),
    ).toBeVisible();
    await expect(
      therapistPage.getByText("Aberto", { exact: true }),
    ).toBeVisible();
    await assertTicket(therapistPage, hml, ticketId, "open", 1);

    await adminPage.goto(
      withShare(
        hml,
        `/admin/suporte?status=open&q=${encodeURIComponent(subject)}`,
      ),
    );
    await expect(
      adminPage.getByRole("heading", { name: "Inbox de atendimento" }),
    ).toBeVisible();
    await expect(
      adminPage.getByRole("heading", { level: 3, name: subject }),
    ).toBeVisible();
    // A navegação direta mantém o acesso compartilhado de HML no cenário
    // externo e evita depender de estado de navegação do browser.
    await adminPage.goto(withShare(hml, `/admin/suporte/${ticketId}`));
    await expect(
      adminPage.getByRole("button", { name: "Atribuir a mim" }),
    ).toBeVisible();
    await adminPage.getByRole("button", { name: "Atribuir a mim" }).click();
    await expect(
      adminPage.getByRole("button", { name: "Remover atribuição" }),
    ).toBeVisible();
    await adminPage.getByLabel("Prioridade").selectOption("high");
    await expect
      .poll(() => adminManagement(adminPage, hml, ticketId))
      .toMatchObject({
        priority: "high",
      });
    await adminPage
      .getByRole("button", { name: "Iniciar atendimento" })
      .click();
    await expect
      .poll(() => adminManagement(adminPage, hml, ticketId))
      .toMatchObject({
        status: "in_progress",
      });
    await expect(
      adminPage.getByRole("heading", { name: "Responder ao solicitante" }),
    ).toBeVisible();
    await adminPage
      .getByLabel("Resposta pública")
      .fill("A equipe TES recebeu sua solicitação e está acompanhando.");
    await adminPage.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(
      adminPage.getByText("Resposta enviada ao solicitante."),
    ).toBeVisible();

    await therapistPage.reload();
    await expect(therapistPage.getByText(/^Equipe TES/)).toBeVisible();
    await expect(
      therapistPage.getByText("Aguardando você", { exact: true }),
    ).toBeVisible();
    await assertTicket(therapistPage, hml, ticketId, "waiting_requester", 2);

    const therapistReply = "QA HML: ainda preciso de ajuda com este chamado.";
    await therapistPage.getByLabel("Responder ao suporte").fill(therapistReply);
    await therapistPage
      .getByRole("button", { name: "Enviar resposta" })
      .click();
    await expect(
      therapistPage.getByText("Aguardando TES", { exact: true }),
    ).toBeVisible();
    await assertTicket(therapistPage, hml, ticketId, "waiting_support", 3);

    await adminPage.goto(
      withShare(
        hml,
        `/admin/suporte?status=waiting_support&priority=high&q=${encodeURIComponent(subject)}`,
      ),
    );
    await expect(
      adminPage.getByRole("heading", { level: 3, name: subject }),
    ).toBeVisible();
    await adminPage.goto(withShare(hml, `/admin/suporte/${ticketId}`));
    await expect(
      adminPage.getByText(therapistReply, { exact: true }),
    ).toBeVisible();
    const internalNote = "QA interna: conferência administrativa concluída.";
    await adminPage.getByLabel("Nota interna").fill(internalNote);
    await adminPage
      .getByRole("button", { name: "Salvar nota interna" })
      .click();
    await expect(adminPage.getByText("Nota interna salva.")).toBeVisible();
    await expect(
      adminPage.getByText(internalNote, { exact: true }),
    ).toBeVisible();

    await therapistPage.reload();
    await expect(
      therapistPage.getByText(internalNote, { exact: true }),
    ).not.toBeVisible();
    await assertTicket(therapistPage, hml, ticketId, "waiting_support", 3);

    await adminPage.getByRole("button", { name: "Resolver chamado" }).click();
    await expect
      .poll(() => adminManagement(adminPage, hml, ticketId))
      .toMatchObject({
        status: "resolved",
      });

    await therapistPage.setViewportSize({ height: 1024, width: 768 });
    await assertNoHorizontalOverflow(therapistPage);
    await therapistPage.setViewportSize({ height: 844, width: 390 });
    await assertNoHorizontalOverflow(therapistPage);
    await therapistPage.reload();
    await expect(
      therapistPage.getByText("Resolvido", { exact: true }),
    ).toBeVisible();
    await expect(
      therapistPage.getByRole("button", { name: "Ainda preciso de ajuda" }),
    ).toBeVisible();
    await assertTicket(therapistPage, hml, ticketId, "resolved", 3);

    await therapistPage
      .getByRole("button", { name: "Ainda preciso de ajuda" })
      .click();
    const reopenReply = "QA HML: preciso retomar este atendimento.";
    const composer = therapistPage.getByLabel("Responder ao suporte");
    await composer.scrollIntoViewIfNeeded();
    await composer.focus();
    await expect(composer).toBeFocused();
    await assertNoHorizontalOverflow(therapistPage);
    await composer.fill(reopenReply);
    await therapistPage
      .getByRole("button", { name: "Enviar resposta" })
      .click();
    await expect(
      therapistPage.getByText("Aguardando TES", { exact: true }),
    ).toBeVisible();
    await assertTicket(therapistPage, hml, ticketId, "waiting_support", 4);

    await adminPage.reload();
    await expect(
      adminPage.getByText(reopenReply, { exact: true }),
    ).toBeVisible();
    await testInfo.attach("support-ticket-id", {
      body: Buffer.from(ticketId),
      contentType: "text/plain",
    });
  } finally {
    await Promise.all([therapistContext.close(), adminContext.close()]);
  }
});

test("HML: participant messaging rejeita conteúdo livre antes de persistir", async ({
  browser,
}) => {
  const hml = assertHmlShareUrl(baseUrl);
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page, context, hml, {
      email: therapistEmail,
      expectedPath: "/terapeuta",
      loginPath: "/terapeuta/login",
      password,
      storageValue: "therapist",
      submitLabel: "Entrar como terapeuta",
    });

    for (const field of ["body", "message", "description", "html"]) {
      const response = await page.request.post(
        withShare(hml, "/api/messages/send-template"),
        {
          data: {
            actorRole: "therapist",
            [field]: "Tentativa de texto livre bloqueada.",
            conversationId: "00000000-0000-4000-8000-000000000000",
            templateKey: "session_confirmation",
          },
        },
      );
      expect(response.status(), `campo ${field}`).toBe(422);
      await expect(response.json()).resolves.toMatchObject({ ok: false });
    }
  } finally {
    await context.close();
  }
});

test("HML: suporte do terapeuta preserva a central nos viewports principais", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const hml = assertHmlShareUrl(baseUrl);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  const page = await context.newPage();

  try {
    await login(page, context, hml, {
      email: therapistEmail,
      expectedPath: "/terapeuta",
      loginPath: "/terapeuta/login",
      password,
      storageValue: "therapist",
      submitLabel: "Entrar como terapeuta",
    });

    for (const viewport of [
      { height: 900, width: 1440 },
      { height: 1024, width: 768 },
      { height: 844, width: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(withShare(hml, "/terapeuta/mensagens"));
      await expect(
        page.getByRole("heading", { name: "Suporte TES" }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  } finally {
    await context.close();
  }
});

async function adminManagement(page: Page, hml: URL, ticketId: string) {
  const response = await page.request.get(
    withShare(hml, `/api/admin/support/tickets/${ticketId}/management`),
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { data?: unknown };
  return body.data;
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page
      .locator("html")
      .evaluate((element) => element.scrollWidth <= window.innerWidth),
  ).toBe(true);
}

async function login(
  page: Page,
  context: BrowserContext,
  hml: URL,
  persona: Persona,
) {
  await context.addCookies([
    {
      name: "tes-e2e-context",
      sameSite: "Lax",
      url: hml.origin,
      value: persona.storageValue,
    },
  ]);
  await page.goto(withShare(hml, persona.loginPath));
  await page.evaluate((value) => {
    localStorage.setItem("tes-e2e-context", value);
    sessionStorage.setItem("tes-e2e-context", value);
  }, persona.storageValue);
  await page.locator('input[name="email"]').fill(persona.email);
  await page.locator('input[name="password"]').fill(persona.password);
  await page.getByRole("button", { name: persona.submitLabel }).click();
  await expect(page).toHaveURL((url) => url.pathname === persona.expectedPath);
}

async function assertTicket(
  page: Page,
  hml: URL,
  ticketId: string,
  expectedStatus: string,
  expectedMessages: number,
) {
  const response = await page.request.get(
    withShare(hml, `/api/support/tickets/${ticketId}`),
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    ticket?: { messages?: unknown[]; status?: string };
  };
  expect(body.ticket?.status).toBe(expectedStatus);
  expect(body.ticket?.messages).toHaveLength(expectedMessages);
}

function assertHmlShareUrl(raw: string) {
  const url = new URL(raw);
  if (
    url.hostname !== "hml.terapeutaeusou.com.br" ||
    !url.searchParams.get("_vercel_share")
  ) {
    throw new Error("PLAYWRIGHT_HML_BASE_URL deve usar a URL HML com share.");
  }
  return url;
}

function ticketIdFromUrl(raw: string) {
  const ticketId = new URL(raw).pathname.split("/").at(-1);
  if (!ticketId) throw new Error("Ticket não foi criado.");
  return ticketId;
}

function withShare(hml: URL, path: string) {
  const url = new URL(path, hml.origin);
  hml.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}
