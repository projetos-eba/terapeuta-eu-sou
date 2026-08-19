import { expect, test } from "@playwright/test";

test("admin login native fallback submits with POST and keeps fields out of the URL", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL: baseURL ?? "http://localhost:3000",
    javaScriptEnabled: false,
  });
  const page = await context.newPage();

  try {
    await page.goto("/admin-login");
    const form = page.locator("form");
    const postRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/admin-login",
    );

    await form.evaluate((element: HTMLFormElement) => element.requestSubmit());

    const request = await postRequest;
    const requestUrl = new URL(request.url());

    expect(requestUrl.searchParams.has("email")).toBe(false);
    expect(requestUrl.searchParams.has("password")).toBe(false);
    await expect(page).not.toHaveURL(/[?&](email|password)=/);
  } finally {
    await context.close();
  }
});
