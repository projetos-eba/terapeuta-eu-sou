import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

const patientEmail =
  process.env.PATIENT_AUTHZ_E2E_EMAIL ?? "paciente.ana@example.test";
const patientPassword =
  process.env.PATIENT_AUTHZ_E2E_PASSWORD ?? "tes-mock-password";

const therapistEmail =
  process.env.THERAPIST_AUTHZ_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_AUTHZ_E2E_PASSWORD ?? "tes-mock-password";

test.describe("admin authorization surface", () => {
  test("redirects anonymous users away from admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin-login(?:\?.*)?$/);
    await expect(
      page.getByRole("button", { name: "Entrar no Admin" }),
    ).toBeVisible();
  });

  test("redirects patient sessions away from admin", async ({ page }) => {
    await loginAsPatient(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin-login(?:\?.*)?$/);
  });

  test("redirects therapist sessions away from admin", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin-login(?:\?.*)?$/);
  });

  test("allows admin sessions into admin", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Visão geral" }),
    ).toBeVisible();
  });
});

async function loginAsAdmin(page: Page) {
  await page.goto("/admin-login");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.locator('input[name="password"]').fill(adminPassword);
  await page.getByRole("button", { name: "Entrar no Admin" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
    timeout: 30_000,
  });
}

async function loginAsPatient(page: Page) {
  await page.goto("/cliente/login");
  await page.getByLabel("E-mail").fill(patientEmail);
  await page.locator('input[name="password"]').fill(patientPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/, { timeout: 30_000 });
}

async function loginAsTherapist(page: Page) {
  await page.goto("/terapeuta/login");
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.locator('input[name="password"]').fill(therapistPassword);
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/, {
    timeout: 30_000,
  });
}
