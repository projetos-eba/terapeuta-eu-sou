import { expect, test } from "@playwright/test";

for (const width of [768, 1_440]) {
  test(`keeps FAQ cards independent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const openedQuestion = faq(
      page,
      "Posso cancelar ou reagendar um encontro?",
    );
    const neighboringQuestion = faq(
      page,
      "Como o TES cuida da minha privacidade?",
    );
    await openedQuestion.scrollIntoViewIfNeeded();
    await neighboringQuestion.scrollIntoViewIfNeeded();
    await openedQuestion.locator("summary").click();

    await expect(openedQuestion).toHaveAttribute("open", "");
    await expect(neighboringQuestion).not.toHaveAttribute("open", "");

    const [openedBounds, neighboringBounds] = await Promise.all([
      openedQuestion.boundingBox(),
      neighboringQuestion.boundingBox(),
    ]);
    expect(openedBounds).not.toBeNull();
    expect(neighboringBounds).not.toBeNull();
    expect(neighboringBounds!.height).toBeLessThan(openedBounds!.height);
  });
}

for (const width of [375, 390, 430]) {
  test(`keeps the journey illustration visible in the mobile banner at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByAltText("Sessão online em tablet")).toHaveAttribute(
      "src",
      /tablet-video-session-2026-08-26-transparent\.png/,
    );

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

function faq(page: import("@playwright/test").Page, question: string) {
  return page.locator("details").filter({
    has: page.getByText(question, { exact: true }),
  });
}
