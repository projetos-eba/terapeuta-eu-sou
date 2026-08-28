import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";

test.describe("therapist Agenda and Sessions foundation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAna(page);
  });

  test("uses the real calendar and opens an owned session detail", async ({
    page,
  }, testInfo) => {
    await expect(page).toHaveURL(/\/terapeuta$/);
    await expect(page.getByText("TES Premium Plus").first()).toBeVisible();

    await page.goto("/terapeuta/agenda?aba=calendario");
    await expect(
      page.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeVisible();
    await expect(page.getByText("Encontros de hoje")).toBeVisible();
    await expect(page.getByText("Insights para sua agenda")).toBeVisible();
    await expect(
      page.getByRole("link", { exact: true, name: "Semana" }),
    ).toHaveAttribute("aria-current", "page");

    const calendarBooking = page.locator('button[aria-label*=" com "]').first();
    await expect(calendarBooking).toBeVisible();
    await calendarBooking.click();
    const bookingDialog = page.getByRole("dialog");
    await expect(bookingDialog).toBeVisible();
    const sessionLink = bookingDialog.getByRole("link", {
      name: "Abrir sessão",
    });
    await expect(sessionLink).toHaveAttribute(
      "href",
      /\/terapeuta\/sessoes\/[0-9a-f-]+$/,
    );
    await sessionLink.click();

    await expect(page).toHaveURL(/\/terapeuta\/sessoes\/[0-9a-f-]+$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Detalhes da sessão" }),
    ).toBeVisible();
    await expect(page.getByText("Pagamento", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Sala de atendimento", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Sessão", { exact: true })).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("session-detail-desktop.png"),
    });

    await page.setViewportSize({ height: 1180, width: 820 });
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Detalhes da sessão" }),
    ).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("session-detail-tablet.png"),
    });

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Detalhes da sessão" }),
    ).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("session-detail-mobile.png"),
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/terapeuta/agenda?aba=calendario");
    await page.getByRole("link", { exact: true, name: "Mês" }).click();
    await expect(page).toHaveURL(/visao=month/);
    await page.getByRole("link", { exact: true, name: "Dia" }).click();
    await expect(page).toHaveURL(/visao=day/);
    await page.getByRole("link", { name: "Adicionar horários" }).click();
    await expect(page).toHaveURL(/aba=horarios/);
    await page.getByRole("link", { exact: true, name: "Calendário" }).click();
    await expect(page).toHaveURL(/aba=calendario/);

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-calendario-desktop.png"),
    });
    await page.setViewportSize({ height: 1180, width: 820 });
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-calendario-tablet.png"),
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Filtrar agenda/ }),
    ).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("region", { name: "Lista cronológica da agenda" }),
    ).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-calendario-mobile.png"),
    });
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
    const serviceSelector = page.getByLabel("Configuração aplicada a", {
      exact: true,
    });
    await expect(serviceSelector).toBeVisible();
    expect(
      await serviceSelector.locator("option").allTextContents(),
    ).not.toContain("Todas as terapias");
    await expect(page.getByText("Reagendamento automático")).toHaveCount(0);

    const saveButton = page.getByRole("button", {
      name: "Salvar alterações",
    });
    await expect(saveButton).toBeDisabled();

    const slotStep = page.getByLabel("Intervalo das sessões", { exact: true });
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
    await expect(
      page.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-horarios-tablet.png"),
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-horarios-mobile.png"),
    });
  });

  test("isolates multiple therapies and blocks an overlapping schedule draft", async ({
    page,
  }) => {
    await page.goto("/terapeuta/agenda?aba=horarios");

    const serviceSelector = page.getByLabel("Configuração aplicada a", {
      exact: true,
    });
    const serviceOptions = await serviceSelector
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => ({
          label: option.textContent?.trim() ?? "",
          value: (option as HTMLOptionElement).value,
        })),
      );

    expect(serviceOptions).toHaveLength(2);
    expect(serviceOptions.map((option) => option.label)).not.toContain(
      "Todas as terapias",
    );

    const [primaryService, secondaryService] = serviceOptions;
    expect(primaryService).toBeDefined();
    expect(secondaryService).toBeDefined();

    await serviceSelector.selectOption(primaryService!.value);
    await expect(
      page.getByRole("button", { name: "Ativar Segunda-feira" }),
    ).toBeVisible();

    await page
      .getByRole("button", { exact: true, name: "Adicionar faixa" })
      .click();
    const addDialog = page.getByRole("dialog", {
      name: "Adicionar faixa de horário",
    });
    await addDialog.getByLabel("Dia da semana").selectOption("1");
    await addDialog
      .getByRole("button", { exact: true, name: "Adicionar faixa" })
      .click();

    const mondayRow = page
      .getByRole("heading", { name: "Segunda-feira" })
      .locator("..")
      .locator("..")
      .locator("..");
    await mondayRow.getByRole("button", { name: "Adicionar horário" }).click();

    const mondayStarts = page.getByLabel("Início de Segunda-feira", {
      exact: true,
    });
    const mondayEnds = page.getByLabel("Fim de Segunda-feira", {
      exact: true,
    });
    await expect(mondayStarts).toHaveCount(2);
    await mondayStarts.nth(1).selectOption("10:00");
    await mondayEnds.nth(1).selectOption("12:00");
    await mondayEnds.nth(1).focus();
    await mondayEnds.nth(1).blur();

    const overlapAlert = page.getByRole("alert").filter({
      hasText: "Essa faixa se sobrepõe",
    });
    await expect(overlapAlert).toContainText(
      "Essa faixa se sobrepõe a outro horário disponível no mesmo dia.",
    );

    let scheduleWriteCount = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/api/therapist/schedule")
      ) {
        scheduleWriteCount += 1;
      }
    });
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(overlapAlert).toContainText(
      "Ajuste os horários antes de continuar.",
    );
    expect(scheduleWriteCount).toBe(0);

    await page.reload();
    await serviceSelector.selectOption(secondaryService!.value);
    let secondarySaved = false;

    try {
      await page
        .getByRole("button", { name: "Tornar disponível" })
        .first()
        .click();
      await page
        .getByLabel("Fim de Segunda-feira", { exact: true })
        .selectOption("11:00");
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(
        page.getByText("Horários salvos com sucesso."),
      ).toBeVisible();
      secondarySaved = true;

      await page.reload();
      await serviceSelector.selectOption(secondaryService!.value);
      await expect(
        page.getByLabel("Início de Segunda-feira", { exact: true }),
      ).toHaveValue("09:00");
      await expect(
        page.getByLabel("Fim de Segunda-feira", { exact: true }),
      ).toHaveValue("11:00");

      await serviceSelector.selectOption(primaryService!.value);
      await expect(
        page.getByLabel("Início de Terça-feira", { exact: true }),
      ).toHaveValue("10:00");
    } finally {
      if (secondarySaved) {
        await page.reload();
        await serviceSelector.selectOption(secondaryService!.value);
        const removeMonday = page.getByRole("button", {
          name: "Excluir faixa 1 de Segunda-feira",
        });
        if (await removeMonday.isVisible()) {
          await removeMonday.click();
          await page.getByRole("button", { name: "Salvar alterações" }).click();
          await expect(
            page.getByText("Horários salvos com sucesso."),
          ).toBeVisible();
        }
      }
    }
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
    await expect(
      page.getByText(
        /Paciente Juliana|Nenhuma sessão precisa de revisão neste período\./,
      ),
    ).toBeVisible();

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
    await expect(blockCard).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("agenda-bloqueios-tablet.png"),
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(blockCard).toBeVisible();
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
  await page.locator('input[name="password"]').fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}

async function expectNoHorizontalPageOverflow(
  page: import("@playwright/test").Page,
) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}
