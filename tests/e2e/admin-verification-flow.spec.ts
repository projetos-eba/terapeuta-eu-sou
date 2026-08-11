import { expect, test } from "@playwright/test";

const isHomologationAudit = process.env.HML_AUDIT === "true";

test.describe("admin professional verification flow", () => {
  test.skip(!isHomologationAudit, "Auditoria de homologação não habilitada.");

  test("reports queue consistency without changing professional state", async ({
    page,
  }, testInfo) => {
    const email = requiredEnvironmentValue("ADMIN_E2E_EMAIL");
    const password = requiredEnvironmentValue("ADMIN_E2E_PASSWORD");
    const shareUrl = process.env.VERCEL_SHARE_URL;

    if (shareUrl) {
      await page.goto(shareUrl);
    }

    await page.goto("/admin-login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
      timeout: 30_000,
    });

    await page.goto("/admin/profissionais");
    await expect(
      page.getByRole("heading", { level: 1, name: "Profissionais" }),
    ).toBeVisible();

    const professionalsText = await page.locator("body").innerText();
    const professionals = {
      approvedLabels: countExactLines(professionalsText, "APROVADO"),
      draftLabels:
        countExactLines(professionalsText, "RASCUNHO") +
        countExactLines(professionalsText, "PERFIL EM CONSTRUÇÃO"),
      inReviewLabels: countExactLines(professionalsText, "EM ANÁLISE"),
      submittedLabels: countExactLines(professionalsText, "AGUARDANDO ANÁLISE"),
    };

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("professionals.png"),
    });

    await page.goto("/admin/profissionais/verificacoes");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Verificações de profissionais",
      }),
    ).toBeVisible();

    const verificationsText = await page.locator("body").innerText();
    const verifications = {
      empty: verificationsText.includes("Nenhuma verificação encontrada"),
      reviewLinks: await page
        .getByRole("link", { name: "Abrir análise" })
        .count(),
    };

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("verifications.png"),
    });

    console.info(
      `Admin verification audit: ${JSON.stringify({ professionals, verifications })}`,
    );

    expect(
      professionals.draftLabels + professionals.submittedLabels,
    ).toBeGreaterThan(0);
  });
});

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required audit environment: ${name}`);
  return value;
}

function countExactLines(value: string, expected: string) {
  const normalizedExpected = expected.toLocaleLowerCase("pt-BR");

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.toLocaleLowerCase("pt-BR") === normalizedExpected)
    .length;
}
