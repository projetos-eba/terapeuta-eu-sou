import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_DOCUMENTS_E2E_EMAIL ?? "rafael.santos@example.test";
const therapistPassword =
  process.env.THERAPIST_DOCUMENTS_E2E_PASSWORD ?? "tes-mock-password";

test.describe("therapist settings", () => {
  test("keeps the address layout and presents safe settings feedback", async ({
    page,
  }, testInfo) => {
    await loginAsTherapist(page);
    await page.goto("/terapeuta/configuracoes", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "Configurações" }),
    ).toBeVisible();

    await page.setViewportSize({ height: 1_000, width: 1_440 });
    const desktopAddress = await addressBounds(page);
    expect(desktopAddress.postalCode.y).toBeCloseTo(desktopAddress.street.y, 0);
    expect(desktopAddress.postalCode.x).toBeLessThan(desktopAddress.street.x);
    expect(desktopAddress.postalCode.width).toBeGreaterThanOrEqual(120);
    expect(desktopAddress.street.width).toBeGreaterThan(
      desktopAddress.postalCode.width,
    );
    await expect(
      page.getByRole("button", { name: "Salvar alterações" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Salvar meus dados" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("settings-desktop-address.png"),
    });

    await page.setViewportSize({ height: 900, width: 390 });
    const mobileAddress = await addressBounds(page);
    expect(mobileAddress.street.y).toBeGreaterThan(mobileAddress.postalCode.y);

    await page.setViewportSize({ height: 1_000, width: 1_440 });
    await page.locator("#postalCode").fill("13060240");
    await page.locator("#street").fill("Rua de teste");
    await page.locator("#streetNumber").fill("100");
    await page.locator("#neighborhood").fill("Centro");
    await page.locator("#city").fill("Campinas");
    await page.locator("#state").fill("SP");
    await page.locator("#documentType").selectOption("cpf");
    await page.locator("#documentNumber").fill("11111111111");
    await page.getByRole("button", { name: "Salvar meus dados" }).click();
    await expect(
      page.getByText(
        "Não foi possível concluir a operação, o CPF não é válido.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("settings-invalid-cpf-dialog.png"),
    });
    await page.getByRole("button", { name: "Entendi" }).click();

    await page.route("**/api/therapist/settings", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          error: {
            code: "CPF_IN_USE",
            message: "Este documento já está em uso em outra conta.",
          },
          ok: false,
        }),
        contentType: "application/json",
        status: 409,
      });
    });
    await page.locator("#documentNumber").fill("52998224725");
    await page.getByRole("button", { name: "Salvar meus dados" }).click();
    await expect(
      page.getByText("Este documento já está em uso em outra conta.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("settings-duplicate-cpf-dialog.png"),
    });
    await page.getByRole("button", { name: "Entendi" }).click();
    await page.unroute("**/api/therapist/settings");

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        mimeType: "application/pdf",
        name: "documento-acima-do-limite.pdf",
      });
    await expect(
      page.getByText(
        "Não foi possível concluir a operação, o tamanho do documento excede o limite de 10 MB.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("settings-document-size-dialog.png"),
    });
  });
});

async function addressBounds(page: import("@playwright/test").Page) {
  const postalCode = await page.getByLabel("CEP").boundingBox();
  const street = await page.locator("#street").boundingBox();
  if (!postalCode || !street) {
    throw new Error("Os campos de CEP e endereço precisam estar visíveis.");
  }
  return { postalCode, street };
}

async function loginAsTherapist(page: import("@playwright/test").Page) {
  await page.goto("/terapeuta/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.locator('input[name="password"]').fill(therapistPassword);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/therapist/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  expect((await loginResponse).status()).toBe(200);
}
