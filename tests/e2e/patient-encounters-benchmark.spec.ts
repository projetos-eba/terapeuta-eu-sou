import { expect, test } from "@playwright/test";

const patientEmail =
  process.env.PATIENT_E2E_EMAIL ?? "carlos.paciente@example.test";
const patientPassword = process.env.PATIENT_E2E_PASSWORD ?? "tes-mock-password";

const viewports = [
  { height: 1000, name: "desktop", width: 1440 },
  { height: 1000, name: "tablet", width: 900 },
  { height: 844, name: "mobile", width: 390 },
];

test.describe("patient encounters benchmark", () => {
  for (const viewport of viewports) {
    test(`${viewport.name} keeps the next encounter and action clear`, async ({
      page,
    }) => {
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });
      await loginAsPatient(page);
      await page.goto("/app/encontros");

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Seus encontros, com clareza.",
        }),
      ).toBeVisible();

      const nextEncounter = page.locator(
        'section[aria-labelledby="patient-next-encounter-title"]',
      );
      await expect(nextEncounter).toBeVisible();
      await expect(nextEncounter.getByRole("link").first()).toBeVisible();
      await nextEncounter.getByRole("link").first().focus();
      await expect(nextEncounter.getByRole("link").first()).toBeFocused();

      const hasPageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasPageOverflow).toBe(false);
      await expect(page.locator("body")).not.toContainText(/meeting_url/i);
      await expect(page.locator("body")).not.toContainText(
        /https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\//i,
      );
      await expect(page.locator("body")).not.toContainText(/\bsess[aã]o\b/i);
    });
  }
});

async function loginAsPatient(page: import("@playwright/test").Page) {
  await page.goto("/cliente/login");
  await page.getByLabel("E-mail").fill(patientEmail);
  await page.getByLabel("Senha").fill(patientPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
}
