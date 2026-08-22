import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_HML_BASE_URL?.trim() ?? "";
const password = process.env.PLAYWRIGHT_HML_PASSWORD ?? "";
const therapistEmail = process.env.PLAYWRIGHT_HML_THERAPIST_EMAIL?.trim() ?? "";
const patientEmail = process.env.PLAYWRIGHT_HML_PATIENT_EMAIL?.trim() ?? "";
const configured = Boolean(
  baseUrl && password && therapistEmail && patientEmail,
);

test.skip(
  !configured,
  "Requer URL HML, senha e e-mails QA de paciente e terapeuta.",
);
test.use({ screenshot: "only-on-failure", trace: "retain-on-failure" });

test("HML: preview e envio estruturado funcionam nas duas direções", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const hml = assertHmlShareUrl(baseUrl);
  const therapistContext = await browser.newContext();
  const patientContext = await browser.newContext();
  const therapistPage = await therapistContext.newPage();
  const patientPage = await patientContext.newPage();

  try {
    await login(
      therapistPage,
      therapistContext,
      hml,
      therapistEmail,
      "/terapeuta/login",
      "/terapeuta",
      "therapist",
      "Entrar como terapeuta",
    );
    await login(
      patientPage,
      patientContext,
      hml,
      patientEmail,
      "/cliente/login",
      "/app",
      "patient",
      "Entrar",
    );

    await therapistPage.goto(withShare(hml, "/terapeuta/mensagens"));
    await expect(
      therapistPage.getByRole("button", { name: "Escolher mensagem" }),
    ).toBeVisible();
    await therapistPage
      .getByRole("button", { name: "Escolher mensagem" })
      .click();
    await therapistPage
      .getByRole("button", { name: "Revisar mensagem" })
      .click();
    await expect(
      therapistPage.getByRole("heading", { name: "Revisar mensagem" }),
    ).toBeVisible();
    await expect(therapistPage.getByText("Mensagem final")).toBeVisible();
    await therapistPage
      .getByRole("button", { name: "Enviar mensagem" })
      .click();
    await expect(
      therapistPage.getByText("Mensagem enviada com segurança."),
    ).toBeVisible();

    await patientPage.goto(withShare(hml, "/app/mensagens"));
    await expect(
      patientPage.getByText(
        /Confirmo que nossa sessão está mantida|Estou disponível na sala|Enviei uma orientação/,
      ),
    ).toBeVisible();

    await patientPage
      .getByRole("button", { name: "Escolher mensagem" })
      .click();
    await patientPage.getByRole("button", { name: "Revisar mensagem" }).click();
    await expect(patientPage.getByText("Mensagem final")).toBeVisible();
    await patientPage.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(
      patientPage.getByText("Mensagem enviada com segurança."),
    ).toBeVisible();

    await therapistPage.reload();
    await expect(
      therapistPage.getByText(
        /Confirmo que estarei presente|Tenho uma dúvida|Preciso solicitar/,
      ),
    ).toBeVisible();
  } finally {
    await Promise.all([therapistContext.close(), patientContext.close()]);
  }
});

test("HML: conteúdo livre e URL arbitrária continuam bloqueados", async ({
  browser,
}) => {
  const hml = assertHmlShareUrl(baseUrl);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await login(
      page,
      context,
      hml,
      therapistEmail,
      "/terapeuta/login",
      "/terapeuta",
      "therapist",
      "Entrar como terapeuta",
    );
    for (const field of ["body", "message", "description", "html", "url"]) {
      const response = await page.request.post(
        withShare(hml, "/api/messages/send-template"),
        {
          data: {
            actorRole: "therapist",
            conversationId: "00000000-0000-4000-8000-000000000000",
            templateKey: "therapist_confirm_session",
            [field]: "tentativa",
          },
        },
      );
      expect(response.status(), field).toBe(422);
    }
  } finally {
    await context.close();
  }
});

test("HML: central estruturada mantém fluxo responsivo", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const hml = assertHmlShareUrl(baseUrl);
  const viewports = [
    { height: 900, label: "desktop", width: 1440 },
    { height: 1024, label: "tablet", width: 768 },
    { height: 844, label: "mobile", width: 390 },
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { height: viewport.height, width: viewport.width },
    });
    const page = await context.newPage();
    try {
      await login(
        page,
        context,
        hml,
        therapistEmail,
        "/terapeuta/login",
        "/terapeuta",
        "therapist",
        "Entrar como terapeuta",
      );
      await page.goto(withShare(hml, "/terapeuta/mensagens"));
      await expect(
        page.getByRole("heading", { name: "Central de mensagens" }),
      ).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, viewport.label).toBeLessThanOrEqual(
        dimensions.clientWidth + 1,
      );
      await page.getByRole("button", { name: "Escolher mensagem" }).click();
      await expect(
        page.getByRole("heading", { name: "Escolher mensagem" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Revisar mensagem" }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  }
});

async function login(
  page: Page,
  context: BrowserContext,
  hml: URL,
  email: string,
  loginPath: string,
  expectedPath: string,
  storageValue: string,
  submitLabel: string,
) {
  await context.addCookies([
    {
      name: "tes-e2e-context",
      sameSite: "Lax",
      url: hml.origin,
      value: storageValue,
    },
  ]);
  await page.goto(withShare(hml, loginPath));
  await page.evaluate((value) => {
    localStorage.setItem("tes-e2e-context", value);
    sessionStorage.setItem("tes-e2e-context", value);
  }, storageValue);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: submitLabel }).click();
  await expect(page).toHaveURL((url) => url.pathname === expectedPath);
}

function assertHmlShareUrl(raw: string) {
  const url = new URL(raw);
  if (
    url.hostname !== "hml.terapeutaeusou.com.br" ||
    !url.searchParams.get("_vercel_share")
  )
    throw new Error("PLAYWRIGHT_HML_BASE_URL deve usar a URL HML com share.");
  return url;
}

function withShare(hml: URL, path: string) {
  const url = new URL(path, hml.origin);
  hml.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}
