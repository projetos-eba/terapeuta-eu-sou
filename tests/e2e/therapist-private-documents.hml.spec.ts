import { expect, test } from "@playwright/test";

const isEnabled = process.env.HML_PRIVATE_DOCUMENTS_E2E === "true";

type HmlFixtures = {
  adminEmail: string;
  adminPassword: string;
  otherTherapistEmail: string;
  otherTherapistPassword: string;
  sharedBaseUrl: string;
  therapistEmail: string;
  therapistPassword: string;
};

type DocumentCenter = {
  documents: Array<{
    fileName: string | null;
    id: string | null;
    kind: "address_proof" | "identity_document";
    status: "accepted" | "rejected" | "uploaded" | "missing";
  }>;
  therapistProfileId: string;
};

test.use({ screenshot: "off", trace: "off", video: "off" });

test.describe("therapist private documents in HML", () => {
  test.skip(!isEnabled, "Homologação privada de documentos não habilitada.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test("uploads, reviews and protects documents using dedicated HML fixtures", async ({
    browser,
  }, testInfo) => {
    const fixtures = readFixtures();
    const therapistContext = await browser.newContext();
    const adminContext = await browser.newContext();
    const otherTherapistContext = await browser.newContext();
    const therapistPage = await therapistContext.newPage();
    const adminPage = await adminContext.newPage();
    const otherTherapistPage = await otherTherapistContext.newPage();

    try {
      await loginAsTherapist(therapistPage, fixtures);
      await gotoShared(
        therapistPage,
        fixtures.sharedBaseUrl,
        "/terapeuta/perfil",
      );
      await expect(
        therapistPage.getByRole("heading", {
          level: 1,
          name: /cadastro|perfil/i,
        }),
      ).toBeVisible();

      await uploadFromCard(
        therapistPage,
        "Documento de identidade",
        validPdf("identidade-hml-e2e.pdf", "Identidade HML E2E"),
      );
      await uploadFromCard(
        therapistPage,
        "Comprovante de endereço",
        validPdf("endereco-hml-e2e.pdf", "Endereço HML E2E"),
      );

      let documentCenter = await readDocumentCenter(therapistPage);
      const identityDocument = documentByKind(
        documentCenter,
        "identity_document",
      );
      const addressDocument = documentByKind(documentCenter, "address_proof");
      expect(identityDocument.id).toBeTruthy();
      expect(addressDocument.id).toBeTruthy();
      expect(identityDocument.status).toBe("uploaded");
      expect(addressDocument.status).toBe("uploaded");
      expect(hasPrivateStorageDetails(documentCenter)).toBe(false);

      await therapistPage.reload({ waitUntil: "domcontentloaded" });
      documentCenter = await readDocumentCenter(therapistPage);
      expect(documentByKind(documentCenter, "identity_document").status).toBe(
        "uploaded",
      );
      expect(documentByKind(documentCenter, "address_proof").status).toBe(
        "uploaded",
      );
      await therapistPage.screenshot({
        fullPage: true,
        path: testInfo.outputPath("therapist-documents-desktop.png"),
      });

      await loginAsAdmin(adminPage, fixtures);
      await gotoShared(
        adminPage,
        fixtures.sharedBaseUrl,
        `/admin/profissionais/${documentCenter.therapistProfileId}`,
      );
      const documentsTab = adminPage.getByRole("tab", { name: "Documentos" });
      await documentsTab.click();
      await expect(documentsTab).toHaveAttribute("aria-selected", "true");
      await expect(
        adminPage.getByRole("heading", { name: "Documentos enviados" }),
      ).toBeVisible();
      await expect(
        adminPage.getByText("Documentos indisponíveis no momento"),
      ).toHaveCount(0);

      await assertProxiedDocumentAccess({
        documentId: requiredDocumentId(documentCenter, "identity_document"),
        page: adminPage,
        professionalId: documentCenter.therapistProfileId,
      });
      await assertProxiedDocumentAccess({
        documentId: requiredDocumentId(documentCenter, "address_proof"),
        page: adminPage,
        professionalId: documentCenter.therapistProfileId,
      });

      const identityCard = adminPage
        .getByText("Documento de identidade", { exact: true })
        .locator("xpath=ancestor::li");
      await identityCard
        .getByRole("button", { name: "Aceitar documento" })
        .click();
      await expect(
        identityCard.getByText("Documento confirmado."),
      ).toBeVisible();

      await therapistPage.reload({ waitUntil: "domcontentloaded" });
      documentCenter = await readDocumentCenter(therapistPage);
      expect(documentByKind(documentCenter, "identity_document").status).toBe(
        "accepted",
      );

      await loginAsTherapist(otherTherapistPage, fixtures, "other");
      const forbiddenResponse = await otherTherapistPage.evaluate(
        async (documentId) => {
          const response = await fetch(
            `/api/therapist/profile/documents/${documentId}`,
            { redirect: "manual" },
          );
          return {
            body: await response.text(),
            location: response.headers.get("location"),
            status: response.status,
          };
        },
        requiredDocumentId(documentCenter, "identity_document"),
      );
      expect(forbiddenResponse.status).toBeGreaterThanOrEqual(400);
      expect(forbiddenResponse.location).toBeNull();
      expect(forbiddenResponse.body).not.toMatch(
        /therapist-private-documents|storage_object_path|signedurl|storage\/v1/i,
      );
    } finally {
      await Promise.all([
        therapistContext.close(),
        adminContext.close(),
        otherTherapistContext.close(),
      ]);
    }
  });

  test("captures the themed editor and public profile without bio illustration controls", async ({
    browser,
  }, testInfo) => {
    const fixtures = readFixtures();
    const context = await browser.newContext({
      viewport: { height: 920, width: 1440 },
    });
    const page = await context.newPage();

    try {
      await loginAsTherapist(page, fixtures);
      await gotoShared(
        page,
        fixtures.sharedBaseUrl,
        "/terapeuta/perfil/editar",
      );

      await expect(page.getByText("Minha essência")).toBeVisible();
      await expect(page.getByText("Ilustração da bio")).toHaveCount(0);
      await expect(page.getByText("Sem ilustração")).toHaveCount(0);
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(
          "profile-editor-no-bio-illustration-desktop.png",
        ),
      });

      const saveButton = page
        .getByRole("button", { name: "Salvar alterações" })
        .first();
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      const publishButton = page
        .getByRole("button", { name: "Publicar alterações" })
        .first();
      await expect(publishButton).toBeEnabled();
      await publishButton.click();
      await page
        .getByRole("dialog", { name: "Publicar alterações?" })
        .getByRole("button", { name: "Publicar alterações" })
        .click();
      await expect(
        page.getByText("A versão pública está sincronizada com o editor."),
      ).toBeVisible();

      const slug = await page
        .getByRole("textbox", { name: /Endereço público/ })
        .inputValue();
      await gotoShared(page, fixtures.sharedBaseUrl, `/terapeutas/${slug}`);
      await expect(
        page.getByRole("button", { name: /Ampliar ilustração/i }),
      ).toHaveCount(0);
      await page.setViewportSize({ height: 820, width: 375 });
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(
          "public-profile-no-bio-illustration-mobile.png",
        ),
      });
    } finally {
      await context.close();
    }
  });
});

function readFixtures(): HmlFixtures {
  const sharedBaseUrl = requiredEnvironmentValue(
    "HML_PRIVATE_DOCUMENTS_E2E_BASE_URL",
  );
  const parsed = new URL(sharedBaseUrl);
  if (
    parsed.protocol !== "https:" ||
    !parsed.searchParams.get("_vercel_share")
  ) {
    throw new Error("hml_private_documents_shared_url_invalid");
  }

  return {
    adminEmail: requiredEnvironmentValue("ADMIN_E2E_EMAIL"),
    adminPassword: requiredEnvironmentValue("ADMIN_E2E_PASSWORD"),
    otherTherapistEmail: requiredEnvironmentValue(
      "THERAPIST_DOCUMENTS_OTHER_E2E_EMAIL",
    ),
    otherTherapistPassword: requiredEnvironmentValue(
      "THERAPIST_DOCUMENTS_OTHER_E2E_PASSWORD",
    ),
    sharedBaseUrl: parsed.toString(),
    therapistEmail: requiredEnvironmentValue("THERAPIST_DOCUMENTS_E2E_EMAIL"),
    therapistPassword: requiredEnvironmentValue(
      "THERAPIST_DOCUMENTS_E2E_PASSWORD",
    ),
  };
}

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`hml_private_documents_${name.toLowerCase()}_missing`);
  return value;
}

function sharedUrl(baseUrl: string, target: string) {
  const shared = new URL(baseUrl);
  const targetUrl = new URL(target, `${shared.origin}/`);
  const share = shared.searchParams.get("_vercel_share");
  if (!share) throw new Error("hml_private_documents_share_missing");
  targetUrl.searchParams.set("_vercel_share", share);
  return targetUrl.toString();
}

async function gotoShared(
  page: import("@playwright/test").Page,
  baseUrl: string,
  target: string,
) {
  await page.goto(sharedUrl(baseUrl, target), {
    waitUntil: "domcontentloaded",
  });
}

async function loginAsTherapist(
  page: import("@playwright/test").Page,
  fixtures: HmlFixtures,
  fixture: "other" | "primary" = "primary",
) {
  await gotoShared(page, fixtures.sharedBaseUrl, "/terapeuta/login");
  await page
    .getByLabel("E-mail")
    .fill(
      fixture === "primary"
        ? fixtures.therapistEmail
        : fixtures.otherTherapistEmail,
    );
  await page
    .getByLabel("Senha")
    .fill(
      fixture === "primary"
        ? fixtures.therapistPassword
        : fixtures.otherTherapistPassword,
    );
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}

async function loginAsAdmin(
  page: import("@playwright/test").Page,
  fixtures: HmlFixtures,
) {
  for (let retriesRemaining = 2; retriesRemaining > 0; retriesRemaining -= 1) {
    await gotoShared(page, fixtures.sharedBaseUrl, "/admin-login");
    await page.getByLabel("E-mail").fill(fixtures.adminEmail);
    await page.getByLabel("Senha").fill(fixtures.adminPassword);
    const loginResponse = page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/auth/admin/login") &&
          response.request().method() === "POST",
        { timeout: 3_000 },
      )
      .catch(() => null);
    await page.getByRole("button", { name: "Entrar no Admin" }).click();
    const response = await loginResponse;

    if (response?.ok()) {
      await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
        timeout: 30_000,
      });
      return;
    }
  }

  throw new Error("hml_private_documents_admin_login_not_started");
}

async function uploadFromCard(
  page: import("@playwright/test").Page,
  title: string,
  file: { buffer: Buffer; mimeType: string; name: string },
) {
  const inputs = page.locator('input[type="file"]');
  await expect(inputs).toHaveCount(2);
  const documentIndex = title === "Documento de identidade" ? 0 : 1;
  const response = await selectDocumentFile(
    page,
    inputs.nth(documentIndex),
    file,
  );
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
    ok?: boolean;
  } | null;
  if (!response.ok() || !payload?.ok) {
    throw new Error(
      `hml_private_documents_upload_failed_${response.status()}_${typeof payload?.error?.message === "string" ? payload.error.message : "no_safe_message"}`,
    );
  }
  await expect
    .poll(async () => {
      const document = documentByKind(
        await readDocumentCenter(page),
        title === "Documento de identidade"
          ? "identity_document"
          : "address_proof",
      );
      return document.id && document.fileName === file.name;
    })
    .toBe(true);
}

async function selectDocumentFile(
  page: import("@playwright/test").Page,
  input: import("@playwright/test").Locator,
  file: { buffer: Buffer; mimeType: string; name: string },
) {
  for (const attempt of [1, 2]) {
    const uploadResponse = page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/therapist/profile/documents") &&
          response.request().method() === "POST",
        { timeout: 3_000 },
      )
      .catch(() => null);
    await input.setInputFiles(file);
    const response = await uploadResponse;
    if (response) return response;

    if (attempt === 1) {
      await input.setInputFiles([]);
    }
  }

  throw new Error("hml_private_documents_upload_not_started");
}

async function readDocumentCenter(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/therapist/profile/documents", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: DocumentCenter | { documentCenter?: DocumentCenter };
      ok?: boolean;
    } | null;
    const data = payload?.data;
    const documentCenter =
      data && typeof data === "object" && "documentCenter" in data
        ? data.documentCenter
        : data;
    if (!response.ok || !payload?.ok || !documentCenter) {
      throw new Error("hml_private_documents_read_failed");
    }
    return documentCenter as DocumentCenter;
  });
}

async function assertProxiedDocumentAccess({
  documentId,
  page,
  professionalId,
}: {
  documentId: string;
  page: import("@playwright/test").Page;
  professionalId: string;
}) {
  const response = await page.evaluate(
    async ({ documentId, professionalId }) => {
      const response = await fetch(
        `/api/admin/profissionais/${professionalId}/documents/${documentId}`,
        { redirect: "manual" },
      );
      return {
        cacheControl: response.headers.get("cache-control"),
        contentType: response.headers.get("content-type"),
        location: response.headers.get("location"),
        status: response.status,
        url: response.url,
      };
    },
    { documentId, professionalId },
  );

  expect(response.status).toBe(200);
  expect(response.contentType).toMatch(/application\/pdf/i);
  expect(response.cacheControl).toMatch(/no-store/i);
  expect(response.location).toBeNull();
  expect(new URL(response.url).pathname).toMatch(/^\/api\/admin\//);
}

function documentByKind(
  documentCenter: DocumentCenter,
  kind: DocumentCenter["documents"][number]["kind"],
) {
  const document = documentCenter.documents.find((item) => item.kind === kind);
  if (!document) throw new Error(`hml_private_documents_${kind}_missing`);
  return document;
}

function requiredDocumentId(
  documentCenter: DocumentCenter,
  kind: DocumentCenter["documents"][number]["kind"],
) {
  const id = documentByKind(documentCenter, kind).id;
  if (!id) throw new Error(`hml_private_documents_${kind}_id_missing`);
  return id;
}

function hasPrivateStorageDetails(value: unknown) {
  return /bucket|object_path|storage_object_path|signedurl|storage\/v1/i.test(
    JSON.stringify(value),
  );
}

function validPdf(name: string, label: string) {
  return {
    buffer: Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj\n<<>>\nendobj\n%%EOF`),
    mimeType: "application/pdf",
    name,
  };
}
