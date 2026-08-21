import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type HmlPersona = {
  buttonName: string;
  email: string;
  expectedPath: string;
  loginPath: string;
  password: string;
  storageValue: string;
};

const hmlBaseUrl = process.env.PLAYWRIGHT_HML_BASE_URL?.trim() ?? "";
const patientEmail = process.env.PLAYWRIGHT_HML_PATIENT_EMAIL?.trim() ?? "";
const therapistEmail = process.env.PLAYWRIGHT_HML_THERAPIST_EMAIL?.trim() ?? "";
const adminEmail = process.env.PLAYWRIGHT_HML_ADMIN_EMAIL?.trim() ?? "";
const hmlPassword = process.env.PLAYWRIGHT_HML_PASSWORD ?? "";
const configured = Boolean(
  hmlBaseUrl && patientEmail && therapistEmail && adminEmail && hmlPassword,
);

test.use({ screenshot: "off", trace: "off", video: "off" });
test.skip(
  !configured,
  "Requer PLAYWRIGHT_HML_BASE_URL e credenciais HML efêmeras para as três personas.",
);

test("HML mantém paciente, terapeuta e Admin em BrowserContexts independentes", async ({
  browser,
}) => {
  const baseUrl = assertHmlShareUrl(hmlBaseUrl);
  const personas: HmlPersona[] = [
    {
      buttonName: "Entrar",
      email: patientEmail,
      expectedPath: "/app",
      loginPath: "/cliente/login",
      password: hmlPassword,
      storageValue: "patient",
    },
    {
      buttonName: "Entrar como terapeuta",
      email: therapistEmail,
      expectedPath: "/terapeuta",
      loginPath: "/terapeuta/login",
      password: hmlPassword,
      storageValue: "therapist",
    },
    {
      buttonName: "Entrar no Admin",
      email: adminEmail,
      expectedPath: "/admin",
      loginPath: "/admin-login",
      password: hmlPassword,
      storageValue: "admin",
    },
  ];
  const contexts = await Promise.all(personas.map(() => browser.newContext()));

  try {
    const pages = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    await Promise.all(
      pages.map((page, index) =>
        loginInIsolatedContext(
          page,
          contexts[index]!,
          personas[index]!,
          baseUrl,
        ),
      ),
    );

    await Promise.all(
      pages.map(async (page, index) => {
        await expect(page).toHaveURL(
          (url) => url.pathname === personas[index]!.expectedPath,
        );
        await expect(page.locator("body")).not.toBeEmpty();
      }),
    );

    const isolatedStorage = await Promise.all(
      pages.map((page) =>
        page.evaluate(() => ({
          local: localStorage.getItem("tes-e2e-context"),
          session: sessionStorage.getItem("tes-e2e-context"),
        })),
      ),
    );
    expect(isolatedStorage).toEqual([
      { local: "patient", session: "patient" },
      { local: "therapist", session: "therapist" },
      { local: "admin", session: "admin" },
    ]);

    const cookieNamesByContext = await Promise.all(
      contexts.map((context) =>
        context
          .cookies(baseUrl.origin)
          .then((cookies) =>
            cookies
              .filter((cookie) => cookie.name === "tes-e2e-context")
              .map((cookie) => cookie.value),
          ),
      ),
    );
    expect(cookieNamesByContext).toEqual([
      ["patient"],
      ["therapist"],
      ["admin"],
    ]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

async function loginInIsolatedContext(
  page: Page,
  context: BrowserContext,
  persona: HmlPersona,
  baseUrl: URL,
) {
  const origin = baseUrl.origin;
  await context.addCookies([
    {
      name: "tes-e2e-context",
      sameSite: "Lax",
      url: origin,
      value: persona.storageValue,
    },
  ]);
  await page.goto(withHmlShare(baseUrl, persona.loginPath));
  await page.evaluate((value) => {
    localStorage.setItem("tes-e2e-context", value);
    sessionStorage.setItem("tes-e2e-context", value);
  }, persona.storageValue);
  await page.locator('input[name="email"]').fill(persona.email);
  await page.locator('input[name="password"]').fill(persona.password);
  await page.getByRole("button", { name: persona.buttonName }).click();
}

function assertHmlShareUrl(rawValue: string) {
  const url = new URL(rawValue);
  if (
    url.hostname !== "hml.terapeutaeusou.com.br" ||
    !url.searchParams.get("_vercel_share")
  ) {
    throw new Error(
      "PLAYWRIGHT_HML_BASE_URL deve ser a URL HML com Vercel Share.",
    );
  }
  return url;
}

function withHmlShare(baseUrl: URL, path: string) {
  const url = new URL(path, baseUrl.origin);
  url.search = baseUrl.search;
  return url.toString();
}
