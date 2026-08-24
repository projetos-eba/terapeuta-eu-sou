import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";

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
        "A estrutura do funil já está pronta. Os números aparecem após a ativação formal da coleta pública.",
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

async function loginAsAna(page: import("@playwright/test").Page) {
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.locator('input[name="password"]').fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}
