import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const runId = process.env.PAYMENTS_E2E_RUN_ID ?? "tes-payments-e2e-local";
const password = process.env.PAYMENTS_E2E_PASSWORD ?? "TesE2e!ChangeMe2026";
const therapistEmail = `${runId}.therapist_free@example.test`.toLowerCase();

test.describe.configure({ mode: "serial" });

test.describe("payments checkout smoke", () => {
  test.beforeAll(() => {
    execFileSync(process.execPath, ["scripts/payments/e2e-data.mjs", "seed"], {
      stdio: "inherit",
    });
  });

  test.afterAll(() => {
    execFileSync(
      process.execPath,
      ["scripts/payments/e2e-data.mjs", "cleanup"],
      {
        stdio: "inherit",
      },
    );
  });

  test("lets a free therapist review the premium checkout before Stripe", async ({
    page,
  }) => {
    await page.goto(
      "/terapeuta/login?next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium",
    );

    await page.getByLabel("E-mail").fill(therapistEmail);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar como terapeuta" }).click();

    await expect(page).toHaveURL(/\/terapeuta\/checkout\?plan=premium/);
    await expect(
      page.getByRole("heading", { name: "Finalize sua assinatura" }),
    ).toBeVisible();
    await expect(page.getByText("TES Premium")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Checkout seguro no TES" }),
    ).toBeVisible();
    await expect(
      page.getByText(/O formulário abaixo é carregado pela Stripe/i),
    ).toBeVisible();
    await expect(
      page.locator("#subscription-embedded-checkout iframe").first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(
        /Premium e Premium Plus só são liberados após confirmação do webhook Stripe/i,
      ),
    ).toBeVisible();
  });

  test("mounts embedded Stripe Checkout for Premium Plus", async ({ page }) => {
    await page.goto(
      "/terapeuta/login?next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium_plus",
    );

    await page.getByLabel("E-mail").fill(therapistEmail);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar como terapeuta" }).click();

    await expect(page).toHaveURL(/\/terapeuta\/checkout\?plan=premium_plus/);
    await expect(page.getByText("TES Premium Plus")).toBeVisible();
    await expect(
      page.locator("#subscription-embedded-checkout iframe").first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("does not create a new embedded checkout after success redirect", async ({
    page,
  }) => {
    await page.goto(
      "/terapeuta/login?next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium_plus%26checkout%3Dsuccess%26session_id%3Dcs_test_fake_success_return",
    );

    await page.getByLabel("E-mail").fill(therapistEmail);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar como terapeuta" }).click();

    await expect(page).toHaveURL(/checkout=success/);
    await expect(
      page.getByText(
        /Confirmando seu pagamento|Confirmacao temporariamente indisponivel/i,
      ),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("#subscription-embedded-checkout iframe"),
    ).toHaveCount(0);
  });
});
