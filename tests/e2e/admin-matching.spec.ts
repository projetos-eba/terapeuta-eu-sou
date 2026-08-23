import { expect, test } from "@playwright/test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

test.describe("admin matching", () => {
  test("keeps focus while typing a new theme and generates a slug", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/);

    await page.goto("/admin/matching");
    await expect(
      page.getByRole("heading", { level: 1, name: "Match" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Novo tema" }).click();
    await expect(page.getByRole("dialog", { name: "Novo tema" })).toBeVisible();

    const name = page.getByLabel("Nome");
    await name.fill("Emoções especiais");

    await expect(name).toBeFocused();
    await expect(page.getByLabel("Slug")).toHaveValue("emocoes-especiais");
    await expect(
      page.getByRole("button", { name: "Fechar" }),
    ).not.toBeFocused();
  });

  test("previews and uploads a theme image without saving the theme", async ({
    page,
  }) => {
    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/);

    await page.goto("/admin/matching");
    await expect(
      page.getByRole("heading", { level: 1, name: "Match" }),
    ).toBeVisible();

    const theme = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Emoções e Bem-Estar" }),
      })
      .first();
    await theme.getByRole("button", { name: "Editar tema" }).click();
    await expect(
      page.getByRole("dialog", { name: "Editar tema" }),
    ).toBeVisible();
    await expect(page.getByAltText("Preview da imagem do tema")).toBeVisible();

    const uploadDir = await mkdtemp(join(tmpdir(), "tes-theme-upload-"));
    const uploadPath = join(uploadDir, "tema.png");
    await writeFile(
      uploadPath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO0d+/efwAIvgNzG8y4kgAAAABJRU5ErkJggg==",
        "base64",
      ),
    );

    await page.locator('input[type="file"]').setInputFiles(uploadPath);
    await expect(page.getByText("Imagem enviada com sucesso.")).toBeVisible();
    await expect(page.getByLabel("URL da imagem")).toHaveValue(
      /\/storage\/v1\/object\/public\/admin-public-media\/matching\/themes\//,
    );
  });
});
