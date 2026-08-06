#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  loadEnvFiles,
} from "./env-utils.mjs";

loadEnvFiles();

const runId = process.env.PAYMENTS_E2E_RUN_ID ?? "tes-payments-e2e-local";
const password = process.env.PAYMENTS_E2E_PASSWORD ?? "TesE2e!ChangeMe2026";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();
const therapistEmail = `${runId}.therapist_free@example.test`.toLowerCase();

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseAnonKey,
  SUPABASE_URL: supabaseUrl,
})) {
  if (!value) {
    console.error(`${name} is required for Billing Portal validation.`);
    process.exit(1);
  }
}

let browser;

try {
  await mkdir("test-results/payments-subscription-portal", {
    recursive: true,
  });
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordVideo: { dir: "test-results/payments-subscription-portal" },
  });
  const page = await context.newPage();

  logStage("open_login");
  await page.goto(
    `${baseUrl}/terapeuta/login?next=${encodeURIComponent(
      "/terapeuta/checkout?plan=premium",
    )}`,
  );
  await page.getByLabel("E-mail").fill(therapistEmail);
  await page.getByLabel("Senha").fill(password);
  logStage("submit_login");
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await page.waitForURL(/\/terapeuta\/checkout\?plan=premium/, {
    timeout: 20_000,
  });

  logStage("wait_billing_portal_button");
  const portalButton = await waitForBillingPortalButton(page);
  logStage("click_billing_portal_button");
  await portalButton.click();
  await page.waitForURL(/billing\.stripe\.com/, { timeout: 30_000 });
  await page.screenshot({
    fullPage: true,
    path: "test-results/payments-subscription-portal/portal-opened.png",
  });

  console.log(
    JSON.stringify({
      ok: true,
      portalOpened: true,
      urlHost: new URL(page.url()).host,
    }),
  );
} finally {
  if (browser) await browser.close();
}

function logStage(stage) {
  console.log(JSON.stringify({ stage }));
}

async function waitForBillingPortalButton(page) {
  const deadline = Date.now() + 60_000;
  const locator = page.getByRole("button", { name: "Gerenciar assinatura" });

  while (Date.now() < deadline) {
    if (await locator.isVisible().catch(() => false)) return locator;
    await page.reload({ waitUntil: "networkidle" });
    await delay(2000);
  }

  await page.screenshot({
    fullPage: true,
    path: "test-results/payments-subscription-portal/button-timeout.png",
  });
  throw new Error("billing_portal_button_not_visible");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
