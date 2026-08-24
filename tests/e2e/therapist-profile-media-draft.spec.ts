import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";

test.describe("therapist profile media draft", () => {
  test("persists the photo draft after leaving and returning to the editor", async ({
    page,
  }) => {
    await page.goto("/terapeuta/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("E-mail").fill(therapistEmail);
    await page.locator('input[name="password"]').fill(therapistPassword);
    await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
    await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);

    await page.goto("/terapeuta/perfil/editar", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "Editar perfil" }),
    ).toBeVisible();

    const photoInput = page.locator('input[type="file"]').first();
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/therapist/profile/media") &&
        response.request().method() === "POST",
    );
    await photoInput.setInputFiles("public/therapists/ana-oliveira.png");
    const response = await uploadResponse;
    expect(response.ok()).toBe(true);

    const uploadedPhoto = page.getByRole("img", {
      name: "Prévia da foto de perfil",
    });
    await expect(uploadedPhoto).toHaveAttribute(
      "src",
      /storage\/v1\/object\/public\/therapist-public-media\//,
    );

    await page.goto("/terapeuta", { waitUntil: "domcontentloaded" });
    await page.goto("/terapeuta/perfil/editar", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("img", { name: "Prévia da foto de perfil" }),
    ).toHaveAttribute(
      "src",
      /storage\/v1\/object\/public\/therapist-public-media\//,
    );
  });
});

