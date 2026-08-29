import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  retries: 0,
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL,
    headless,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  workers: 1,
  projects: [
    {
      name: "msedge",
      use: {
        ...devices["Desktop Chrome"],
        channel: "msedge",
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "webkit-mobile",
      testMatch: /zoom-preview\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
});
