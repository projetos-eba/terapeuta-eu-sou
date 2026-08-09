import { mkdir, writeFile } from "node:fs/promises";

import { expect, test, type Browser, type Page } from "@playwright/test";

const patientEmail =
  process.env.PATIENT_E2E_EMAIL ?? "carlos.paciente@example.test";
const patientPassword = process.env.PATIENT_E2E_PASSWORD ?? "tes-mock-password";
const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";
const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "invalid-admin@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "invalid-password";

const artifactRoot = ".tmp/playwright-auth-click";

const scenarios = [
  {
    actor: "patient",
    buttonName: "Entrar",
    email: patientEmail,
    expectedUrl: /\/app\/favoritos\/terapeutas(?:\?.*)?$/,
    loginPath: "/cliente/login?next=/app/favoritos/terapeutas",
    password: patientPassword,
  },
  {
    actor: "therapist",
    buttonName: "Entrar como terapeuta",
    email: therapistEmail,
    expectedUrl: /\/terapeuta(?:\?.*)?$/,
    loginPath: "/terapeuta/login",
    password: therapistPassword,
  },
] as const;

const viewports = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
] as const;

test.describe("auth real click regression", () => {
  for (const scenario of scenarios) {
    for (const viewport of viewports) {
      test(`${scenario.actor} login button accepts a real click on ${viewport.label}`, async ({
        browser,
        baseURL,
      }, testInfo) => {
        const result = await runLoginClickScenario(browser, {
          ...scenario,
          baseURL: baseURL ?? "http://localhost:3000",
          viewport,
        });

        await testInfo.attach("hit-test-before-click.json", {
          body: JSON.stringify(result.hitTest, null, 2),
          contentType: "application/json",
        });
        await testInfo.attach("screenshot-before-click", {
          path: result.beforeScreenshotPath,
          contentType: "image/png",
        });
        await testInfo.attach("screenshot-after-click", {
          path: result.afterScreenshotPath,
          contentType: "image/png",
        });
        if (result.videoPath) {
          await testInfo.attach("video", {
            path: result.videoPath,
            contentType: "video/webm",
          });
        }

        expect(result.hitTest.elementFromPoint?.isTargetOrInside).toBe(true);
        expect(result.finalUrl).toMatch(scenario.expectedUrl);
      });
    }
  }

  for (const viewport of viewports) {
    test(`admin login button accepts a real click on ${viewport.label}`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      const result = await runAdminLoginClickScenario(browser, {
        baseURL: baseURL ?? "http://localhost:3000",
        viewport,
      });

      await testInfo.attach("hit-test-before-click.json", {
        body: JSON.stringify(result.hitTest, null, 2),
        contentType: "application/json",
      });
      await testInfo.attach("field-hit-tests-before-fill.json", {
        body: JSON.stringify(result.fieldHitTests, null, 2),
        contentType: "application/json",
      });
      await testInfo.attach("screenshot-before-click", {
        path: result.beforeScreenshotPath,
        contentType: "image/png",
      });
      await testInfo.attach("screenshot-after-click", {
        path: result.afterScreenshotPath,
        contentType: "image/png",
      });
      if (result.videoPath) {
        await testInfo.attach("video", {
          path: result.videoPath,
          contentType: "video/webm",
        });
      }

      expect(result.hitTest.elementFromPoint?.isTargetOrInside).toBe(true);
      expect(result.outcome).toMatch(/^(authenticated|auth-error)$/);
    });
  }
});

async function runLoginClickScenario(
  browser: Browser,
  config: (typeof scenarios)[number] & {
    baseURL: string;
    viewport: (typeof viewports)[number];
  },
) {
  const artifactPrefix = `${config.actor}-${config.viewport.label}`;
  const screenshotDir = `${artifactRoot}/screenshots`;
  const videoDir = `${artifactRoot}/videos`;
  const hitTestDir = `${artifactRoot}/hit-tests`;
  await Promise.all([
    mkdir(hitTestDir, { recursive: true }),
    mkdir(screenshotDir, { recursive: true }),
    mkdir(videoDir, { recursive: true }),
  ]);

  const context = await browser.newContext({
    baseURL: config.baseURL,
    colorScheme: "light",
    recordVideo: {
      dir: videoDir,
      size: {
        height: config.viewport.height,
        width: config.viewport.width,
      },
    },
    reducedMotion: "reduce",
    viewport: {
      height: config.viewport.height,
      width: config.viewport.width,
    },
  });
  const page = await context.newPage();

  const beforeScreenshotPath = `${screenshotDir}/${artifactPrefix}-before.png`;
  const afterScreenshotPath = `${screenshotDir}/${artifactPrefix}-after.png`;
  const hitTestPath = `${hitTestDir}/${artifactPrefix}.json`;
  let videoPath: string | null = null;

  try {
    await page.goto(config.loginPath);
    await page.getByLabel("E-mail").fill(config.email);
    await page.getByLabel("Senha").fill(config.password);

    const button = page.getByRole("button", { name: config.buttonName });
    await expect(button).toBeVisible();
    await button.scrollIntoViewIfNeeded();
    const hitTest = await getClickHitTest(page, config.buttonName);
    await writeFile(hitTestPath, JSON.stringify(hitTest, null, 2));
    await page.screenshot({ path: beforeScreenshotPath });

    await button.click();
    await expect(page).toHaveURL(config.expectedUrl);
    const finalUrl = page.url();
    await page.screenshot({ path: afterScreenshotPath });

    await context.close();
    videoPath =
      (await page
        .video()
        ?.path()
        .catch(() => null)) ?? null;

    return {
      afterScreenshotPath,
      beforeScreenshotPath,
      finalUrl,
      hitTest,
      videoPath,
    };
  } catch (error) {
    await page.screenshot({ path: afterScreenshotPath }).catch(() => undefined);
    videoPath =
      (await page
        .video()
        ?.path()
        .catch(() => null)) ?? null;
    await context.close().catch(() => undefined);

    throw error;
  }
}

async function runAdminLoginClickScenario(
  browser: Browser,
  config: {
    baseURL: string;
    viewport: (typeof viewports)[number];
  },
) {
  const artifactPrefix = `admin-${config.viewport.label}`;
  const screenshotDir = `${artifactRoot}/screenshots`;
  const videoDir = `${artifactRoot}/videos`;
  const hitTestDir = `${artifactRoot}/hit-tests`;
  await Promise.all([
    mkdir(hitTestDir, { recursive: true }),
    mkdir(screenshotDir, { recursive: true }),
    mkdir(videoDir, { recursive: true }),
  ]);

  const context = await browser.newContext({
    baseURL: config.baseURL,
    colorScheme: "light",
    recordVideo: {
      dir: videoDir,
      size: {
        height: config.viewport.height,
        width: config.viewport.width,
      },
    },
    reducedMotion: "reduce",
    viewport: {
      height: config.viewport.height,
      width: config.viewport.width,
    },
  });
  const page = await context.newPage();

  const beforeScreenshotPath = `${screenshotDir}/${artifactPrefix}-before.png`;
  const afterScreenshotPath = `${screenshotDir}/${artifactPrefix}-after.png`;
  const hitTestPath = `${hitTestDir}/${artifactPrefix}.json`;
  const fieldHitTestPath = `${hitTestDir}/${artifactPrefix}-fields.json`;
  let videoPath: string | null = null;

  try {
    await page.goto("/admin-login");
    const emailField = page.getByLabel("E-mail");
    const passwordField = page.getByLabel("Senha");
    const fieldHitTests = {
      email: await getInputHitTest(page, "#email"),
      password: await getInputHitTest(page, "#password"),
    };
    await writeFile(fieldHitTestPath, JSON.stringify(fieldHitTests, null, 2));

    await emailField.click();
    await expect(emailField).toBeFocused();
    await emailField.fill(adminEmail);
    await passwordField.click();
    await expect(passwordField).toBeFocused();
    await passwordField.fill(adminPassword);

    const button = page.getByRole("button", { name: "Entrar no Admin" });
    await expect(button).toBeVisible();
    await button.scrollIntoViewIfNeeded();
    const hitTest = await getClickHitTest(page, "Entrar no Admin");
    await writeFile(hitTestPath, JSON.stringify(hitTest, null, 2));
    await page.screenshot({ path: beforeScreenshotPath });

    await button.click();
    await page.waitForFunction(
      () =>
        window.location.pathname === "/admin" ||
        window.location.pathname.startsWith("/admin/") ||
        Boolean(document.querySelector('[role="alert"]')),
    );
    const pathname = new URL(page.url()).pathname;
    const outcome =
      pathname === "/admin" || pathname.startsWith("/admin/")
        ? "authenticated"
        : "auth-error";
    await page.screenshot({ path: afterScreenshotPath });

    await context.close();
    videoPath =
      (await page
        .video()
        ?.path()
        .catch(() => null)) ?? null;

    return {
      afterScreenshotPath,
      beforeScreenshotPath,
      fieldHitTests,
      hitTest,
      outcome,
      videoPath,
    };
  } catch (error) {
    await page.screenshot({ path: afterScreenshotPath }).catch(() => undefined);
    videoPath =
      (await page
        .video()
        ?.path()
        .catch(() => null)) ?? null;
    await context.close().catch(() => undefined);

    throw error;
  }
}

async function getClickHitTest(page: Page, buttonName: string) {
  return page.getByRole("button", { name: buttonName }).evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const elementFromPoint = document.elementFromPoint(x, y);
    const fixedOrAbsoluteAncestors: Array<{
      className: string;
      pointerEvents: string;
      position: string;
      tagName: string;
      zIndex: string;
    }> = [];

    let current: Element | null = button;
    while (current) {
      const styles = window.getComputedStyle(current);
      if (
        styles.position === "fixed" ||
        styles.position === "absolute" ||
        styles.pointerEvents === "none" ||
        styles.transform !== "none"
      ) {
        fixedOrAbsoluteAncestors.push({
          className:
            current instanceof HTMLElement ? String(current.className) : "",
          pointerEvents: styles.pointerEvents,
          position: styles.position,
          tagName: current.tagName,
          zIndex: styles.zIndex,
        });
      }
      current = current.parentElement;
    }

    return {
      boundingBox: {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      },
      clickPoint: { x, y },
      elementFromPoint: elementFromPoint
        ? {
            className:
              elementFromPoint instanceof HTMLElement
                ? elementFromPoint.className
                : "",
            id: elementFromPoint.id,
            isTargetOrInside:
              elementFromPoint === button || button.contains(elementFromPoint),
            tagName: elementFromPoint.tagName,
            text: elementFromPoint.textContent?.trim().slice(0, 120) ?? "",
          }
        : null,
      fixedOrAbsoluteAncestors,
    };
  });
}

async function getInputHitTest(page: Page, selector: string) {
  return page.locator(selector).evaluate((input) => {
    const rect = input.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const elementFromPoint = document.elementFromPoint(x, y);

    return {
      boundingBox: {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      },
      clickPoint: { x, y },
      elementFromPoint: elementFromPoint
        ? {
            className:
              elementFromPoint instanceof HTMLElement
                ? elementFromPoint.className
                : "",
            id: elementFromPoint.id,
            isTargetOrInside:
              elementFromPoint === input || input.contains(elementFromPoint),
            tagName: elementFromPoint.tagName,
            text: elementFromPoint.textContent?.trim().slice(0, 120) ?? "",
          }
        : null,
    };
  });
}
