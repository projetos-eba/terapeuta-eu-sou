import { expect, test } from "@playwright/test";

test.describe("public matching journey", () => {
  test("keeps Match context through therapy, profile, and reservation", async ({
    page,
  }) => {
    await page.goto("/sua-jornada");

    await page
      .getByRole("button", { name: /Emoções e Bem-Estar/ })
      .click();

    const themePanel = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Emoções e Bem-Estar" }),
    });
    await themePanel.getByRole("button").first().click();

    await page.getByRole("button", { name: /Ver caminhos para mim/ }).click();
    await expect(page).toHaveURL(/\/sua-jornada\/resultado/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Caminhos que podem conversar com seu momento",
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Conhecer terapia/ }).first().click();
    await expect(page).toHaveURL(/\/terapias\/[^/?]+(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", {
        name: "Profissionais alinhados ao que você selecionou",
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Ver perfil/ }).first().click();
    await expect(page).toHaveURL(/\/terapeutas\/[^/?]+(?:\?.*)?$/);

    const bookingLink = page.getByRole("link", { name: /Agendar sessão/ }).first();
    await expect(bookingLink).toHaveAttribute(
      "href",
      /\/reserva\?.*service=[0-9a-f-]{36}/,
    );
    await bookingLink.click();
    await expect(page).toHaveURL(/\/reserva\?.*service=[0-9a-f-]{36}/);
  });

  test("uses default professional ordering on direct therapy access", async ({
    page,
  }) => {
    await page.goto("/terapias/reiki");

    await expect(
      page.getByRole("heading", {
        name: "Profissionais que trabalham com Reiki",
      }),
    ).toBeVisible();
  });
});
