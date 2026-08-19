import { expect, test } from "@playwright/test";

const isEnabled = process.env.HML_PATIENT_FAVORITES_E2E === "true";

type HmlFixtures = {
  patientEmail: string;
  patientPassword: string;
  sharedBaseUrl: string;
  therapistSlug: string;
};

test.use({ screenshot: "on", trace: "on", video: "on" });

test.describe("patient favorites in HML", () => {
  test.skip(!isEnabled, "Homologação HML de favoritos não habilitada.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test("requires login, persists a favorite in the patient panel and shares only the public URL", async ({
    browser,
  }, testInfo) => {
    const fixtures = readFixtures();
    const context = await browser.newContext({
      viewport: { height: 900, width: 1440 },
    });
    const page = await context.newPage();

    try {
      await gotoShared(page, fixtures.sharedBaseUrl, profilePath(fixtures));
      await page
        .getByRole("button", { name: /Adicionar aos favoritos de/i })
        .click();
      await expect(page).toHaveURL(/\/cliente\/login\?next=/);

      await page.getByLabel("E-mail").fill(fixtures.patientEmail);
      await page.getByLabel("Senha").fill(fixtures.patientPassword);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(
        new RegExp(`/terapeutas/${fixtures.therapistSlug}(?:\\?.*)?$`),
      );

      const therapistName = await page
        .getByRole("heading", { level: 1 })
        .innerText();
      const favoriteButton = page.getByRole("button", {
        name: new RegExp(
          `(?:Adicionar aos|Remover dos) favoritos de ${escapeRegExp(therapistName)}`,
          "i",
        ),
      });
      if ((await favoriteButton.getAttribute("aria-pressed")) === "true") {
        await favoriteButton.click();
        await expect(favoriteButton).toHaveAttribute("aria-pressed", "false");
      }

      await favoriteButton.click();
      await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath("public-profile-favorited-desktop.png"),
      });

      await gotoShared(
        page,
        fixtures.sharedBaseUrl,
        "/app/favoritos/terapeutas",
      );
      const favoriteCard = page
        .getByRole("heading", { level: 2, name: therapistName })
        .locator("xpath=ancestor::article");
      await expect(favoriteCard).toBeVisible();
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath("patient-favorites-desktop.png"),
      });

      await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async ({ url }: { url: string }) => {
            Reflect.set(window, "__tesSharedProfileUrl", url);
          },
        });
      });
      await gotoShared(page, fixtures.sharedBaseUrl, profilePath(fixtures));
      await page.getByRole("button", { name: "Compartilhar perfil" }).click();
      const sharedUrl = await page.evaluate(() =>
        Reflect.get(window, "__tesSharedProfileUrl"),
      );
      expect(sharedUrl).toBe(
        new URL(profilePath(fixtures), page.url()).toString(),
      );
      expect(String(sharedUrl)).not.toContain("_vercel_share");

      await page
        .getByRole("button", {
          name: `Remover dos favoritos de ${therapistName}`,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: `Adicionar aos favoritos de ${therapistName}`,
        }),
      ).toHaveAttribute("aria-pressed", "false");
    } finally {
      await context.close();
    }
  });
});

function readFixtures(): HmlFixtures {
  const sharedBaseUrl = requiredEnvironmentValue(
    "HML_PATIENT_FAVORITES_E2E_BASE_URL",
  );
  const parsed = new URL(sharedBaseUrl);
  if (
    parsed.protocol !== "https:" ||
    !parsed.searchParams.get("_vercel_share")
  ) {
    throw new Error("hml_patient_favorites_shared_url_invalid");
  }

  return {
    patientEmail: requiredEnvironmentValue("HML_PATIENT_FAVORITES_E2E_EMAIL"),
    patientPassword: requiredEnvironmentValue(
      "HML_PATIENT_FAVORITES_E2E_PASSWORD",
    ),
    sharedBaseUrl: parsed.toString(),
    therapistSlug: requiredEnvironmentValue(
      "HML_PATIENT_FAVORITES_E2E_THERAPIST_SLUG",
    ),
  };
}

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`hml_patient_favorites_${name.toLowerCase()}_missing`);
  return value;
}

function profilePath(fixtures: HmlFixtures) {
  return `/terapeutas/${fixtures.therapistSlug}`;
}

function sharedUrl(baseUrl: string, target: string) {
  const shared = new URL(baseUrl);
  const targetUrl = new URL(target, `${shared.origin}/`);
  const share = shared.searchParams.get("_vercel_share");
  if (!share) throw new Error("hml_patient_favorites_share_missing");
  targetUrl.searchParams.set("_vercel_share", share);
  return targetUrl.toString();
}

async function gotoShared(
  page: import("@playwright/test").Page,
  baseUrl: string,
  target: string,
) {
  await page.goto(sharedUrl(baseUrl, target), {
    waitUntil: "domcontentloaded",
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
