import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

test.describe("admin therapy catalog", () => {
  test("logs in, lists therapies, creates draft and blocks incomplete publication", async ({
    page,
  }) => {
    const unique = Date.now();
    const name = `Terapia Admin E2E ${unique}`;
    const slug = `terapia-admin-e2e-${unique}`;

    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin\/terapias(?:\?.*)?$/);

    await expect(
      page.getByRole("heading", { level: 1, name: "Terapias" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reiki" })).toBeVisible();

    await page.getByPlaceholder("Nome, slug, alias").fill("taro");
    await expect(page.getByRole("heading", { name: "Tarô" })).toBeVisible();
    await page.getByPlaceholder("Nome, slug, alias").fill("");

    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(
      page.getByRole("dialog", { name: "Criar rascunho" }),
    ).toBeVisible();
    await expect(
      page.getByAltText("Previa visual de Emoções e Bem-Estar"),
    ).toBeVisible();
    await page.getByLabel("Nome canônico").fill(name);
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("Resumo").fill("Resumo administrativo seguro.");
    await page
      .getByLabel("Abordagem / descrição editorial")
      .fill("Conteúdo seguro sem promessa de resultado.");
    await page.getByLabel("Benefício 1").fill("Pausa de presença");
    await page.getByLabel("Ícone visual 1").selectOption("pause");
    await page
      .getByLabel("Benefício 2")
      .fill("Cuidado energético complementar");
    await page.getByLabel("Ícone visual 2").selectOption("energy");
    await page.getByLabel("Pergunta 1").fill("Como acontece online?");
    await page
      .getByLabel("Resposta")
      .fill("A sessão acontece por vídeo, com orientação do terapeuta.");
    await page
      .getByRole("group", {
        name: "Selecione de 1 a 3 temas do Match para recomendar esta terapia",
      })
      .getByRole("checkbox")
      .nth(0)
      .check();
    await page
      .getByRole("group", {
        name: "Selecione de 1 a 3 temas do Match para recomendar esta terapia",
      })
      .getByRole("checkbox")
      .nth(1)
      .check();
    await page
      .getByRole("group", {
        name: "Selecione de 1 a 3 temas do Match para recomendar esta terapia",
      })
      .getByRole("checkbox")
      .nth(2)
      .check();
    await expect(page.getByText("3 de 3 temas selecionados")).toBeVisible();
    await page
      .getByLabel("Motivo da alteração")
      .fill("Criação E2E do catálogo administrativo.");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();

    const card = page.locator("article").filter({ hasText: name });
    await card.getByRole("button", { name: "Publicar" }).first().click();
    await page
      .getByLabel("Motivo administrativo")
      .fill("Tentativa E2E de publicação incompleta.");
    await page.getByRole("button", { name: "Confirmar" }).click();

    await expect(
      page.getByText("Complete o conteudo publico antes de publicar."),
    ).toBeVisible();
  });
});
