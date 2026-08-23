import { expect, test } from "@playwright/test";

const patientEmail =
  process.env.PATIENT_E2E_EMAIL ?? "carlos.paciente@example.test";
const patientPassword = process.env.PATIENT_E2E_PASSWORD ?? "tes-mock-password";
const bookingId =
  process.env.ZOOM_E2E_BOOKING_ID ?? "94000000-0000-4000-8000-000000000021";

test.describe("patient meeting URL privacy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cliente/login");
    await page.getByLabel("E-mail").fill(patientEmail);
    await page.locator('input[name="password"]').fill(patientPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
  });

  for (const path of [
    "/app",
    "/app/encontros",
    `/app/encontros/${bookingId}`,
  ]) {
    test(`does not render raw meeting_url on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText(/meeting_url/i);
      await expect(page.locator("body")).not.toContainText(
        /https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\//i,
      );

      const html = await page.content();
      expect(html).not.toMatch(/meeting_url/i);
      expect(html).not.toMatch(/https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\//i);
    });
  }
});
