import { expect, test } from "@playwright/test";

const viewports = [
  { height: 1080, label: "wide desktop", width: 1920 },
  { height: 1000, label: "desktop", width: 1440 },
  { height: 900, label: "tablet", width: 1024 },
  { height: 844, label: "mobile", width: 390 },
] as const;

for (const viewport of viewports) {
  test(`renders Como funciona without horizontal overflow on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sobre-nos", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Entre quem procura.*existe um encontro/i,
      }),
    ).toBeVisible();

    const heroImage = page.getByAltText(
      "Duas mulheres em ambientes de cuidado e trabalho conectadas pelo Terapeuta Eu Sou",
    );
    await expect(heroImage).toHaveAttribute("src", /q=95/);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
      "font-weight",
      "300",
    );

    await expect(
      page.getByTestId("about-hero").getByRole("link", {
        name: "Conheça o TES",
      }),
    ).toHaveCount(0);

    if (viewport.label === "wide desktop") {
      const bounds = await heroImage.boundingBox();

      expect(bounds).not.toBeNull();
      expect(bounds!.x + bounds!.width).toBeGreaterThanOrEqual(
        viewport.width - 16,
      );
    }

    if (viewport.label === "desktop") {
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
        "font-size",
        "56px",
      );
    }

    if (viewport.label === "mobile") {
      const headingBounds = await page
        .getByRole("heading", { level: 1 })
        .boundingBox();

      expect(headingBounds).not.toBeNull();
      expect(headingBounds!.x).toBeGreaterThanOrEqual(16);
      expect(headingBounds!.x + headingBounds!.width).toBeLessThanOrEqual(
        viewport.width - 16,
      );
    }

    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((resolve) => window.setTimeout(resolve, 40));
      }
      window.scrollTo(0, 0);
    });

    await page.waitForFunction(() =>
      [...document.images].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const failedImages = await page
      .locator("img")
      .evaluateAll((images) =>
        (images as HTMLImageElement[])
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.getAttribute("src")),
      );
    expect(failedImages).toEqual([]);
  });
}

test("navigates to O que é o TES? from the desktop header and footer", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page
    .locator("header")
    .getByRole("link", { name: "O que é o TES?" })
    .click();
  await expect(page).toHaveURL(/\/sobre-nos$/);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .locator("footer")
    .getByRole("link", { name: "O que é o TES?" })
    .click();
  await expect(page).toHaveURL(/\/sobre-nos$/);
});

test("navigates to O que é o TES? from the mobile navigation", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await page.waitForTimeout(500);

  const menuButton = page.locator('button[aria-controls="public-mobile-menu"]');
  await expect(menuButton).toHaveAccessibleName("Abrir menu");
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");

  await page
    .locator("#public-mobile-menu")
    .getByRole("link", { name: "O que é o TES?" })
    .click();
  await expect(page).toHaveURL(/\/sobre-nos$/);
});
