import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";

test.describe("therapist finance", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAna(page);
  });

  test("loads the four approved financial tabs with real contracts", async ({
    page,
  }) => {
    await page.goto("/terapeuta/financeiro");

    await expect(
      page.getByRole("heading", { level: 1, name: "Financeiro completo" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Resumo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("link", { name: "Recebimentos" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Repasses" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Conta de recebimento" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^Histórico$/i })).toHaveCount(
      0,
    );
    await expect(page.getByText("Valor bruto das sessões")).toBeVisible();
    await expect(page.getByText("Comissão TES")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ticket médio" }),
    ).toBeVisible();
    await expect(page.getByText("Taxa de retorno")).toBeVisible();
    await expect(
      page
        .getByLabel("Métricas financeiras Premium")
        .getByRole("heading", { name: "Terapias que mais faturam" }),
    ).toBeVisible();
    await expect(page.getByText("Evolução financeira")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Previsão do mês" }),
    ).toBeVisible();
    await expect(page.getByText("Realizado líquido")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Receita contratada futura" }),
    ).toBeVisible();
    await expect(page.getByText("Potencial estimado da agenda")).toBeVisible();
    await expect(
      page.getByText(/não representa receita garantida/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Oportunidade do mês" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Benchmark anonimizado" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Recebimentos" }).click();
    await expect(page).toHaveURL(/\/terapeuta\/financeiro\?tab=recebimentos$/);
    await expect(
      page.getByRole("heading", { name: "Recebimentos do período" }),
    ).toBeVisible();
    await expect(page.getByText(/Método de pagamento e origem/)).toBeVisible();

    await page.getByRole("link", { name: "Repasses" }).click();
    await expect(page).toHaveURL(/\/terapeuta\/financeiro\?tab=repasses$/);
    await expect(
      page.getByRole("heading", { name: "Repasses do período" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Conta de recebimento" }).click();
    await expect(page).toHaveURL(/\/terapeuta\/financeiro\?tab=conta$/);
    await expect(page.getByText(/ambiente seguro da Stripe/)).toBeVisible();
    await expect(page.getByLabel(/agência/i)).toHaveCount(0);
    await expect(page.getByLabel(/pix/i)).toHaveCount(0);
    await expect(page.getByLabel(/cpf/i)).toHaveCount(0);
    await expect(page.getByLabel(/cnpj/i)).toHaveCount(0);
  });

  test("keeps the financial shell responsive", async ({ page }) => {
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ height: 900, width });
      await page.goto("/terapeuta/financeiro");

      await expect(
        page.getByRole("heading", { level: 1, name: "Financeiro completo" }),
      ).toBeVisible();
      await expect(page.getByLabel("Período financeiro")).toBeVisible();
      await expect(page.getByText("Valor líquido do terapeuta")).toBeVisible();

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
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.getByLabel("Senha").fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}
