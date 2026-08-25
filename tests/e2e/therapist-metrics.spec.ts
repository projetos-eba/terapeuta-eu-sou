import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";
const metricsEmptyEmail =
  process.env.THERAPIST_METRICS_EMPTY_E2E_EMAIL ??
  "metricas.vazio@example.test";
const metricsFullEmail =
  process.env.THERAPIST_METRICS_FULL_E2E_EMAIL ??
  "metricas.completo@example.test";

test.describe("therapist metrics and reports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAna(page);
  });

  test("loads the real overview and changes the comparison period", async ({
    page,
  }) => {
    await page.goto("/terapeuta/insights");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Acompanhe seu trabalho",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Visualizações do perfil" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Interessados em agendar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sessões realizadas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Taxa de retorno" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "A estrutura do funil está pronta. Os números de descoberta só aparecem após a ativação formal e segura dessa coleta.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ocupação da agenda" }),
    ).toBeVisible();

    await page.getByLabel("Período das métricas").selectOption("90");
    await page.getByRole("button", { name: "Atualizar" }).click();

    await expect(page).toHaveURL(
      /\/terapeuta\/insights\?tab=overview&period=90$/,
    );
    await expect(
      page.getByText("Últimos 90 dias completos", { exact: true }),
    ).toBeVisible();
  });

  test("navigates across MTR-4 and MTR-5 with shareable URLs", async ({
    page,
  }) => {
    await page.goto("/terapeuta/insights");

    await page
      .getByLabel("Visões de métricas")
      .getByRole("link", { name: "Sessões" })
      .click();
    await expect(page).toHaveURL(
      /\/terapeuta\/insights\?tab=sessions&period=30$/,
    );
    await expect(
      page.getByRole("heading", { name: "Movimento das sessões" }),
    ).toBeVisible();
    await expect(page.getByText("Presença operacional")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Distribuição por dia e horário",
      }),
    ).toBeVisible();

    await page
      .getByLabel("Visões de métricas")
      .getByRole("link", { name: "Interesse" })
      .click();
    await expect(page).toHaveURL(
      /\/terapeuta\/insights\?tab=interest&period=30$/,
    );
    await expect(
      page.getByRole("heading", {
        name: "Continuidade do acompanhamento",
      }),
    ).toBeVisible();
    await expect(page.getByText("Favoritos que viraram sessão")).toBeVisible();
  });

  test("shows point details in the sessions chart tooltip", async ({
    page,
  }) => {
    await page.goto("/terapeuta/insights");

    const chart = page.getByLabel(
      "Evolução diária das sessões concluídas no período",
    );
    const points = chart.locator(".recharts-area-dot");
    await expect(points.first()).toBeVisible();
    await points.first().hover();

    await expect(
      page.getByRole("tooltip").filter({ hasText: "Atual ·" }),
    ).toBeVisible();
    await expect(page.getByRole("tooltip")).toContainText("Anterior ·");
  });

  test("exports the authorized aggregate report as CSV", async ({ page }) => {
    await page.goto("/terapeuta/insights?tab=sessions&period=30");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Baixar relatório em CSV" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("tes-metricas-sessions-30d.csv");
  });

  test("keeps the overview usable across responsive widths", async ({
    page,
  }) => {
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ height: 920, width });
      await page.goto("/terapeuta/insights");

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Acompanhe seu trabalho",
        }),
      ).toBeVisible();
      await expect(page.getByLabel("Período das métricas")).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Evolução das sessões",
        }),
      ).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((node) => {
          node.remove();
        });

        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(hasHorizontalOverflow).toBe(false);

      await page.goto("/terapeuta/insights?tab=sessions&period=30");
      await expect(
        page.getByRole("heading", { name: "Movimento das sessões" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        ),
      ).toBe(false);

      if (width === 320 || width === 768) {
        await page.goto("/terapeuta/insights?tab=interest&period=30");
        await expect(
          page.getByRole("heading", {
            name: "Continuidade do acompanhamento",
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1,
          ),
        ).toBe(false);
      }
    }
  });
});

test.describe("therapist metrics visual states", () => {
  test("renders a truthful initial state without reviews, Aura or demo values", async ({
    page,
  }) => {
    await loginAsTherapist(page, metricsEmptyEmail, therapistPassword);
    await page.goto("/terapeuta/insights");

    await expect(
      page.getByRole("heading", { name: "O que aparecerá com seu histórico" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Seus indicadores começam a ser preenchidos conforme o perfil recebe movimento, a agenda é utilizada e as sessões são concluídas.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Avaliações recebidas")).toHaveCount(0);
    await expect(page.getByText("Nota média")).toHaveCount(0);
    await expect(page.getByText("Insights & oportunidades")).toHaveCount(0);
    await expect(page.getByText("Demanda por abordagem")).toHaveCount(0);
    await expect(
      page.getByLabel("Mapa de calor de sessões: ainda sem dados"),
    ).toHaveCount(1);
  });

  test("renders accumulated data and changes real values between 30 and 90 days", async ({
    page,
  }) => {
    await loginAsTherapist(page, metricsFullEmail, therapistPassword);
    await page.goto("/terapeuta/insights?tab=overview&period=30");

    const sessionsCard = page
      .getByRole("article")
      .filter({ hasText: "Sessões realizadas" });
    await expect(sessionsCard.getByText("12", { exact: true })).toBeVisible();
    await expect(sessionsCard.locator(".recharts-tooltip-wrapper")).toHaveCount(
      0,
    );
    await expect(sessionsCard.locator('[data-point-count="3"]')).toHaveCount(1);
    await expect(page.getByText("Valor", { exact: true })).toHaveCount(0);
    const tones = await page
      .locator("article[data-tone]")
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-tone")),
      );
    expect(tones).toEqual(
      expect.arrayContaining(["primary", "mint", "cyan", "warning", "danger"]),
    );
    await expect(
      page.getByRole("heading", { name: "Top terapias" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Mapa de calor de sessões por dia e horário"),
    ).toHaveCount(1);
    const evolutionFigure = page
      .getByLabel("Evolução diária das sessões concluídas no período")
      .locator("..");
    await expect(evolutionFigure).toContainText("Atual ·");
    await expect(evolutionFigure).toContainText("Anterior ·");
    await expect(
      evolutionFigure.locator(".recharts-line-curve[stroke-dasharray]"),
    ).toHaveCount(1);

    await page.getByLabel("Período das métricas").selectOption("90");
    await page.getByRole("button", { name: "Atualizar" }).click();

    await expect(page).toHaveURL(
      /\/terapeuta\/insights\?tab=overview&period=90$/,
    );
    await expect(
      page
        .getByRole("article")
        .filter({ hasText: "Sessões realizadas" })
        .getByText("22", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Avaliações recebidas")).toHaveCount(0);
    await expect(page.getByText("Insights & oportunidades")).toHaveCount(0);

    await page.goto("/terapeuta/insights?tab=sessions&period=90");
    await expect(page.getByText(/Atual · 27 de mai\. – 24 de ago\./)).toBeVisible();
    await expect(page.getByText(/Anterior · 26 de fev\. – 26 de mai\./)).toBeVisible();

    await page.goto("/terapeuta/insights?tab=interest&period=30");
    const peopleChart = page.getByLabel(
      "Evolução da base acompanhada no período",
    );
    await expect(peopleChart).toBeVisible();
    await peopleChart.locator(".recharts-area-dot").first().hover();
    await expect(
      page.getByRole("tooltip").filter({ hasText: "Base acompanhada" }),
    ).toBeVisible();
    await expect(page.getByRole("tooltip")).toContainText("Novas pessoas");
  });
});

async function loginAsAna(page: import("@playwright/test").Page) {
  await loginAsTherapist(page, therapistEmail, therapistPassword);
}

async function loginAsTherapist(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}
