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
          name: "Seu espaço de acompanhamento",
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

  test("shows pending confirmations in a responsive four-item scroll region", async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.PATIENT_ENCOUNTERS_FEEDBACK_FIXTURE !== "1",
      "Requires the local five-item patient feedback fixture.",
    );

    await loginAsPatient(page);
    await page.goto("/app/encontros");

    const nextEncounter = page.locator(
      'section[aria-labelledby="patient-next-encounter-title"]',
    );
    const pendingSection = page.locator(
      'section[aria-labelledby="pending-feedback-title"]',
    );
    const pendingRegion = page.getByRole("region", {
      name: "Lista de confirmações pendentes",
    });

    await expect(nextEncounter).toBeVisible();
    await expect(pendingRegion).toBeVisible();
    expect(
      (await nextEncounter.boundingBox())?.y ?? Number.POSITIVE_INFINITY,
    ).toBeLessThan((await pendingSection.boundingBox())?.y ?? -1);
    expect(await pendingRegion.getByRole("article").count()).toBe(5);

    for (const viewport of [
      { height: 1000, label: "desktop", width: 1440, expectedColumns: 2 },
      { height: 1000, label: "tablet", width: 900, expectedColumns: 1 },
      { height: 844, label: "mobile", width: 390, expectedColumns: 1 },
    ]) {
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });
      await expect(pendingRegion).toBeVisible();

      const layout = await pendingRegion.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const columns = style.gridTemplateColumns.match(/\d+(?:\.\d+)?px/g);
        return {
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          columns: columns?.length ?? 0,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          scrollHeight: element.scrollHeight,
          scrollWidth: element.scrollWidth,
        };
      });

      expect(layout.columns).toBe(viewport.expectedColumns);
      expect(layout.overflowX).toBe("auto");
      expect(layout.overflowY).toBe("auto");
      expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);

      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`patient-encounters-${viewport.label}.png`),
      });
    }

    const lastConfirmation = pendingRegion
      .getByRole("article")
      .last()
      .getByRole("button", { name: "Confirmar encontro" });
    await lastConfirmation.scrollIntoViewIfNeeded();
    await lastConfirmation.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("paginates the history without removing its scroll container", async ({
    page,
  }) => {
    test.skip(
      process.env.PATIENT_ENCOUNTERS_FEEDBACK_FIXTURE !== "1",
      "Requires the local patient history fixture.",
    );

    await loginAsPatient(page);
    await page.goto("/app/encontros");

    const historyScroll = page.locator(
      '[data-testid="patient-history-scroll"]',
    );
    const pagination = page.getByRole("navigation", {
      name: "Paginação do histórico de encontros",
    });
    const nextPage = pagination.getByRole("link", {
      name: "Próxima página do histórico",
    });

    await expect(historyScroll).toBeVisible();
    await expect(
      historyScroll.getByText("Já realizada").first(),
    ).toBeVisible();
    await expect(pagination).toBeVisible();
    await expect(nextPage).toHaveAttribute(
      "href",
      "/app/encontros?historyPage=2#patient-history-encounters-title",
    );
    await nextPage.click();
    await expect(page).toHaveURL(/\/app\/encontros\?historyPage=2/);
    await expect(page.getByText("Página 2 de", { exact: false })).toBeVisible();
    await expect(
      page.locator('[data-testid="patient-history-scroll"]'),
    ).toBeVisible();

    const hasPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasPageOverflow).toBe(false);
  });
});

async function loginAsPatient(page: import("@playwright/test").Page) {
  await page.goto("/cliente/login");
  await page.getByLabel("E-mail").fill(patientEmail);
  await page.locator('input[name="password"]').fill(patientPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
}
