import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";

test.describe("therapist profile editor", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await loginAsAna(page);
  });

  test("saves a private draft, publishes it, and updates the public profile", async ({
    page,
  }) => {
    const intro = `Perfil validado pelo E2E M2 ${Date.now()}, com atendimento online e linguagem responsável.`;

    await gotoShellRoute(page, "/terapeuta/perfil");
    await expect(
      page.getByRole("heading", { level: 1, name: "Perfil público" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Preview do perfil" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Editar perfil" }).click();
    await expect(page).toHaveURL(/\/terapeuta\/perfil\/editar(?:\?.*)?$/);

    const publicCheckPage = await page.context().newPage();
    await gotoShellRoute(publicCheckPage, "/terapeutas/ana-oliveira");
    await expect(publicCheckPage.getByText(intro)).toHaveCount(0);
    await expect(publicCheckPage.getByText(/documento/i)).toHaveCount(0);
    await publicCheckPage.close();
    await page.bringToFront();

    await page.getByLabel("Texto curto").fill(intro);
    await page.getByText("Acolhedor", { exact: true }).click();
    await expect(page.getByText("Ilustração da bio")).toHaveCount(0);
    await expect(page.getByText("Sem ilustração")).toHaveCount(0);

    await expect(page.getByLabel("Texto curto")).toHaveValue(intro);
    const saveButton = page.getByRole("button", {
      name: "Salvar alterações",
    });
    if ((await saveButton.count()) > 0) {
      await saveButton.first().click();
      await expect(
        page.getByText("Existe um rascunho salvo aguardando publicação."),
      ).toBeVisible();
    }

    const publishButton = page.getByRole("button", {
      name: "Publicar alterações",
    });
    await expect(publishButton.first()).toBeEnabled();
    await publishButton.first().scrollIntoViewIfNeeded();
    await publishButton.first().click();
    await expect(
      page.getByRole("dialog", { name: "Publicar alterações?" }),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "Publicar alterações?" })
      .getByRole("button", { name: "Publicar alterações" })
      .click();
    await expect(
      page.getByText("A versão pública está sincronizada com o editor."),
    ).toBeVisible();
    await expect(page.getByText(/2 a 3 horas/).first()).toBeVisible();

    await gotoShellRoute(page, "/terapeuta/perfil");
    await expect(page.getByText(intro)).toBeVisible();

    await gotoShellRoute(page, "/terapeutas/ana-oliveira");
    await expect(page.getByText(intro)).toBeVisible();
    await expect(page.getByText("Atendimento online")).toBeVisible();
    await expect(page.locator('[data-profile-theme="warm"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Ampliar ilustração/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/documento/i)).toHaveCount(0);
  });

  test("updates a Premium slug and keeps the previous URL redirecting", async ({
    page,
  }) => {
    const nextSlug = `ana-presenca-${Date.now()}`;
    await gotoShellRoute(page, "/terapeuta/perfil/editar");
    const slugInput = page.getByRole("textbox", { name: /Endereço público/ });
    await slugInput.fill(nextSlug);
    await expect(page.getByText("Este link está disponível.")).toBeVisible();
    await page.getByRole("button", { name: "Salvar link" }).click();
    await expect(
      page.getByText("Este é o link atual do seu perfil."),
    ).toBeVisible();

    await gotoShellRoute(page, `/terapeutas/${nextSlug}`);
    await expect(page).toHaveURL(new RegExp(`/terapeutas/${nextSlug}$`));
    await gotoShellRoute(page, "/terapeutas/ana-oliveira");
    await expect(page).toHaveURL(new RegExp(`/terapeutas/${nextSlug}$`));
  });

  test("keeps the profile editor usable across responsive widths", async ({
    page,
  }) => {
    for (const width of [320, 375, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ height: 920, width });
      await gotoShellRoute(page, "/terapeuta/perfil");

      await expect(
        page.getByRole("heading", { level: 1, name: "Perfil público" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Editar perfil" }),
      ).toBeVisible();
      await expect(page.getByText("Preview do perfil")).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((node) => {
          node.remove();
        });

        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(hasHorizontalOverflow).toBe(false);
    }
  });
});

async function loginAsAna(page: import("@playwright/test").Page) {
  await gotoShellRoute(page, "/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.getByLabel("Senha").fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}

async function gotoShellRoute(
  page: import("@playwright/test").Page,
  url: string,
) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
