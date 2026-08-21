import { expect, test } from "@playwright/test";

for (const width of [375, 390, 430]) {
  test(`keeps the journey illustration visible in the mobile banner at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const banner = page.getByTestId("home-journey-cta");
    const heading = banner.getByRole("heading", {
      name: "Comece pela sua jornada",
    });
    const action = banner.getByRole("link", {
      name: "Começar minha jornada",
    });

    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expect(action).toBeVisible();

    const mobileIllustration = banner.locator("img").nth(1);
    await expect(mobileIllustration).toBeVisible();
    await expect(mobileIllustration).toHaveJSProperty("naturalWidth", width);

    const bannerBounds = await banner.boundingBox();
    const illustrationBounds = await mobileIllustration.boundingBox();
    expect(bannerBounds).not.toBeNull();
    expect(illustrationBounds).not.toBeNull();
    expect(bannerBounds!.height).toBeGreaterThanOrEqual(720);
    expect(illustrationBounds!.height).toBeGreaterThanOrEqual(400);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
