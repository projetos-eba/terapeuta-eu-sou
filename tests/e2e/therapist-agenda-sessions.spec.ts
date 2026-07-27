import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";

test.describe("therapist Agenda and Sessions foundation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAna(page);
  });

  test("loads canonical routes and an owned session detail", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/terapeuta$/);
    await expect(page.getByText("TES Premium Plus").first()).toBeVisible();

    await page.goto("/terapeuta/agenda?aba=calendario");
    await expect(
      page.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeVisible();
    await expect(page.getByText("Reservas no período")).toBeVisible();

    await page.goto("/terapeuta/sessoes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sessões" }),
    ).toBeVisible();

    const detailLink = page.locator('a[href^="/terapeuta/sessoes/"]').first();
    await expect(detailLink).toBeVisible();
    await detailLink.click();

    await expect(page).toHaveURL(/\/terapeuta\/sessoes\/[0-9a-f-]+$/);
    await expect(page.getByText("Pagamento", { exact: true })).toBeVisible();
    await expect(page.getByText("Segurança da sala")).toBeVisible();
  });

  test("does not expose another therapist booking", async ({ page }) => {
    await page.goto("/terapeuta/sessoes/f1000000-0000-4000-8000-000000000002");

    await expect(
      page.getByRole("heading", { level: 1, name: "404" }),
    ).toBeVisible();
    await expect(page.getByText("Pagamento", { exact: true })).toHaveCount(0);
  });

  test("edits the schedule draft and keeps unimplemented controls out", async ({
    page,
  }, testInfo) => {
    await page.goto("/terapeuta/agenda?aba=horarios");

    await expect(
      page.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Disponibilidade semanal" }),
    ).toBeVisible();
    await expect(page.getByLabel("Configuração aplicada a")).toBeVisible();
    await expect(page.getByText("Reagendamento automático")).toHaveCount(0);

    const saveButton = page.getByRole("button", {
      name: "Salvar alterações",
    });
    await expect(saveButton).toBeDisabled();

    const slotStep = page.getByLabel("Intervalo de oferta dos horários");
    const originalSlotStep = await slotStep.inputValue();
    const temporarySlotStep = originalSlotStep === "45" ? "30" : "45";
    await slotStep.selectOption(temporarySlotStep);
    await saveButton.click();
    await expect(page.getByText("Horários salvos com sucesso.")).toBeVisible();
    await slotStep.selectOption(originalSlotStep);
    await saveButton.click();
    await expect(page.getByText("Horários salvos com sucesso.")).toBeVisible();

    await page
      .getByRole("button", { exact: true, name: "Adicionar faixa" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Adicionar faixa de horário" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();

    await page
      .getByRole("button", { name: /Desativar|Ativar/ })
      .first()
      .click();
    await expect(saveButton).toBeEnabled();

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-horarios-desktop.png"),
    });
    await page.setViewportSize({ height: 1180, width: 820 });
    await page.waitForTimeout(300);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-horarios-tablet.png"),
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await page.waitForTimeout(300);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-horarios-mobile.png"),
    });
  });

  test("creates and removes a real availability block responsively", async ({
    page,
  }, testInfo) => {
    await page.goto("/terapeuta/agenda?aba=bloqueios");

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Bloqueios e indisponibilidades",
      }),
    ).toBeVisible();
    await expect(page.getByText("Sessões para revisar")).toBeVisible();
    await expect(page.getByText(/Paciente Juliana/)).toBeVisible();

    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + 25);
    const dateKey = targetDate.toISOString().slice(0, 10);
    const note = `Bloqueio E2E ${Date.now()}`;

    await page.getByRole("button", { name: "Novo bloqueio" }).click();
    await expect(
      page.getByRole("dialog", { name: "Novo bloqueio" }),
    ).toBeVisible();
    await expect(page.getByTestId("tes-dialog-overlay")).toHaveCSS(
      "background-color",
      "rgba(20, 16, 90, 0.56)",
    );
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-bloqueios-modal-overlay-desktop.png"),
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Novo bloqueio" }).click();
    await page.getByLabel("Data inicial").fill(dateKey);
    await page.getByLabel("Motivo do bloqueio").selectOption("administrative");
    await page.getByLabel("Observação opcional").fill(note);
    await page.getByRole("button", { name: "Criar bloqueio" }).click();

    await expect(page.getByText("Bloqueio salvo com sucesso.")).toBeVisible();
    const blockCard = page.locator("article").filter({ hasText: note });
    await expect(blockCard).toBeVisible();
    await expect(
      blockCard.getByText("Dia inteiro", { exact: true }),
    ).toBeVisible();

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-bloqueios-desktop.png"),
    });
    await page.setViewportSize({ height: 1180, width: 820 });
    await page.waitForTimeout(300);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-bloqueios-tablet.png"),
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await page.waitForTimeout(300);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-bloqueios-mobile.png"),
    });

    await blockCard.getByRole("button", { name: /Remover bloqueio/ }).click();
    await page
      .getByRole("button", { exact: true, name: "Remover bloqueio" })
      .click();
    await expect(blockCard).toHaveCount(0);
  });
});

test.describe("therapist shell mobile", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("opens the authenticated drawer on Agenda", async ({ page }) => {
    await loginAsAna(page);
    await page.goto("/terapeuta/agenda?aba=horarios");

    await page.getByRole("button", { exact: true, name: "Abrir menu" }).click();
    await expect(page.getByRole("link", { name: "Sessões" })).toBeVisible();
    await page
      .getByRole("button", { exact: true, name: "Fechar menu" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeVisible();
  });
});

async function loginAsAna(page: import("@playwright/test").Page) {
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.getByLabel("Senha").fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}
