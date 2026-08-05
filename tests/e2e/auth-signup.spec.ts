import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const password = "TesteAuth123!";

test.describe("auth signup smoke", () => {
  test("creates therapist account and redirects to email confirmation", async ({
    page,
  }) => {
    await page.goto("/terapeuta/cadastro");
    await page.getByRole("link", { name: "Selecionar Free" }).click();
    await expect(page).toHaveURL(/\/terapeuta\/cadastro\?plan=free/);

    await page.getByLabel("Nome completo").fill("Teste Terapeuta UI");
    await page.getByLabel("E-mail").fill(makeTestEmail("therapist"));
    await page.getByLabel("Celular").fill("11999990000");
    await page.getByLabel("Data de nascimento").fill("1990-01-01");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
    await page.getByRole("checkbox").check();

    await page.getByRole("button", { name: "Criar minha conta" }).click();

    await expect(page).toHaveURL(/\/confirmar-email\?statusToken=.+/);
  });

  test("creates client account and redirects to email confirmation", async ({
    page,
  }) => {
    await page.goto("/cliente/cadastro");

    await page.getByLabel("Nome").fill("Teste Cliente UI");
    await page.getByLabel("E-mail").fill(makeTestEmail("client"));
    await page.getByLabel("Celular").fill("11999990001");
    await page.getByLabel("Data de nascimento").fill("1994-04-04");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
    await page.getByRole("checkbox").check();

    await page.getByRole("button", { name: "Criar minha conta" }).click();

    await expect(page).toHaveURL(/\/confirmar-email\?statusToken=.+/);
  });
});

function makeTestEmail(scope: "client" | "therapist") {
  const configuredRecipient = readLocalEnv("EMAIL_E2E_RECIPIENT");
  const suffix = `${scope}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  if (configuredRecipient) {
    const [local, domain] = configuredRecipient.split("@");
    if (local && domain) {
      return `${local}+authui-${suffix}@${domain}`;
    }
  }

  return `authui-${suffix}@example.com`;
}

function readLocalEnv(name: string) {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    const line = lines.find((entry) => entry.trim().startsWith(`${name}=`));
    if (!line) return null;

    return line
      .slice(name.length + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return null;
  }
}
