import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_E2E_EMAIL ?? "ana.oliveira@example.test";
const therapistPassword =
  process.env.THERAPIST_E2E_PASSWORD ?? "tes-mock-password";
const otherTherapistEmail =
  process.env.THERAPIST_DOCUMENTS_OTHER_E2E_EMAIL ??
  "rafael.santos@example.test";
const adminEmail = process.env.ADMIN_E2E_EMAIL ?? "admin.tes@example.test";
const adminPassword = process.env.ADMIN_E2E_PASSWORD ?? "tes-mock-password";

type DocumentCenter = {
  documents: Array<{
    fileName: string | null;
    id: string | null;
    kind: "address_proof" | "identity_document";
    status: "accepted" | "rejected" | "uploaded" | "missing";
  }>;
  therapistProfileId: string;
  verificationStatus: string;
};

test.describe("therapist private documents", () => {
  test.setTimeout(180_000);

  test("stores, protects, reviews and re-requests documents through the real local Storage flow", async ({
    browser,
  }) => {
    const therapistContext = await browser.newContext();
    const therapistPage = await therapistContext.newPage();
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const adminPageErrors: string[] = [];
    adminPage.on("pageerror", (error) => {
      adminPageErrors.push(error.name);
    });
    const otherTherapistContext = await browser.newContext();
    const otherTherapistPage = await otherTherapistContext.newPage();

    try {
      await loginAsTherapist(therapistPage, therapistEmail);
      await assertTherapistProfileRead(therapistPage);
      await therapistPage.goto("/terapeuta/perfil", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        therapistPage.getByRole("heading", {
          level: 1,
          name: /cadastro|perfil/i,
        }),
      ).toBeVisible();

      // The controlled fixture is renewable: each run replaces both current
      // documents without needing to reset the database or Storage.
      await readDocumentCenter(therapistPage);

      await uploadFromCard(
        therapistPage,
        "Documento de identidade",
        validPdf("identidade-e2e.pdf", "Identidade E2E"),
      );
      await uploadFromCard(
        therapistPage,
        "Comprovante de endereço",
        validPdf("endereco-e2e.pdf", "Endereço E2E"),
      );

      let documentCenter = await readDocumentCenter(therapistPage);
      const initialIdentity = documentByKind(
        documentCenter,
        "identity_document",
      );
      const initialAddress = documentByKind(documentCenter, "address_proof");
      expect(initialIdentity.id).toBeTruthy();
      expect(initialAddress.id).toBeTruthy();
      expect(
        documentCenterPayloadHasPrivateStorageDetails(documentCenter),
      ).toBe(false);

      await therapistPage.reload({ waitUntil: "domcontentloaded" });
      documentCenter = await readDocumentCenter(therapistPage);
      expect(documentByKind(documentCenter, "identity_document").id).toBe(
        initialIdentity.id,
      );
      expect(documentByKind(documentCenter, "address_proof").id).toBe(
        initialAddress.id,
      );

      await uploadFromCard(
        therapistPage,
        "Documento de identidade",
        validPdf("identidade-substituida-e2e.pdf", "Identidade substituída"),
      );
      documentCenter = await readDocumentCenter(therapistPage);
      const replacementIdentity = documentByKind(
        documentCenter,
        "identity_document",
      );
      expect(replacementIdentity.id).toBeTruthy();
      expect(replacementIdentity.id).not.toBe(initialIdentity.id);

      await uploadFromCard(
        therapistPage,
        "Documento de identidade",
        {
          buffer: Buffer.from("este arquivo não possui assinatura PDF"),
          mimeType: "application/pdf",
          name: "arquivo-invalido.pdf",
        },
        false,
      );
      await expect(
        therapistPage
          .getByRole("alert")
          .filter({ hasText: /conteúdo do arquivo/i }),
      ).toContainText(/conteúdo do arquivo/i);
      documentCenter = await readDocumentCenter(therapistPage);
      expect(documentByKind(documentCenter, "identity_document").id).toBe(
        replacementIdentity.id,
      );

      const verificationBeforeDocumentReview =
        documentCenter.verificationStatus;
      const identityDocumentId = requiredDocumentId(
        documentCenter,
        "identity_document",
      );
      const addressDocumentId = requiredDocumentId(
        documentCenter,
        "address_proof",
      );

      await loginAsAdmin(adminPage);
      await adminPage.goto(
        `/admin/profissionais/${documentCenter.therapistProfileId}`,
        { waitUntil: "domcontentloaded" },
      );
      const documentsTab = adminPage.getByRole("tab", { name: "Documentos" });
      await documentsTab.click();
      await expect(
        documentsTab,
        `Admin detail hydration errors: ${adminPageErrors.join(", ") || "none"}`,
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        adminPage.getByRole("heading", { name: "Documentos enviados" }),
      ).toBeVisible();

      await assertProxiedDocumentAccess({
        documentId: identityDocumentId,
        page: adminPage,
        professionalId: documentCenter.therapistProfileId,
      });
      await assertProxiedDocumentAccess({
        documentId: addressDocumentId,
        page: adminPage,
        professionalId: documentCenter.therapistProfileId,
      });

      await adminPage
        .getByRole("button", { name: "Aceitar documento" })
        .first()
        .click();
      await adminPage.waitForLoadState("domcontentloaded");
      await adminPage.getByRole("tab", { name: "Documentos" }).click();

      await adminPage
        .getByRole("button", { name: "Solicitar reenvio" })
        .last()
        .click();
      const reason = adminPage.getByLabel("Orientação para o profissional");
      await reason.fill("Envie um comprovante mais recente e legível.");
      await adminPage
        .getByRole("button", { name: "Confirmar solicitação" })
        .click();
      await adminPage.waitForLoadState("domcontentloaded");

      await therapistPage.reload({ waitUntil: "domcontentloaded" });
      await expect(therapistPage.getByText("Reenvio solicitado")).toBeVisible();
      await expect(
        therapistPage.getByText("Envie um comprovante mais recente e legível."),
      ).toBeVisible();
      documentCenter = await readDocumentCenter(therapistPage);
      expect(documentByKind(documentCenter, "identity_document").status).toBe(
        "accepted",
      );
      expect(documentByKind(documentCenter, "address_proof").status).toBe(
        "rejected",
      );
      expect(documentCenter.verificationStatus).toBe(
        verificationBeforeDocumentReview,
      );

      await uploadFromCard(
        therapistPage,
        "Comprovante de endereço",
        validPdf("endereco-reenviado-e2e.pdf", "Endereço reenviado"),
      );
      documentCenter = await readDocumentCenter(therapistPage);
      expect(documentByKind(documentCenter, "address_proof").status).toBe(
        "uploaded",
      );

      await loginAsTherapist(otherTherapistPage, otherTherapistEmail);
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
        identityDocumentId,
      );
      expect(forbiddenResponse.status).toBeGreaterThanOrEqual(400);
      expect(forbiddenResponse.location).toBeNull();
      expect(forbiddenResponse.body).not.toMatch(
        /therapist-private-documents|storage_object_path|signedurl/i,
      );

      await assertSignedUrlExpires({
        documentId: identityDocumentId,
        page: therapistPage,
      });
    } finally {
      await Promise.all([
        therapistContext.close(),
        adminContext.close(),
        otherTherapistContext.close(),
      ]);
    }
  });
});

async function loginAsTherapist(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/terapeuta/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(therapistPassword);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/therapist/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar como terapeuta" }).click();
  const response = await responsePromise;
  if (!response.ok()) {
    const payload = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    throw new Error(
      `Therapist local login failed with ${response.status()}: ${typeof payload?.message === "string" ? payload.message : "no safe message"}`,
    );
  }
  await expect(page).toHaveURL(/\/terapeuta(?:\?.*)?$/);
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin-login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.getByLabel("Senha").fill(adminPassword);
  await page.getByRole("button", { name: "Entrar no Admin" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/terapias)?(?:\?.*)?$/, {
    timeout: 30_000,
  });
}

async function assertTherapistProfileRead(
  page: import("@playwright/test").Page,
) {
  const accessToken = (await page.context().cookies()).find(
    (cookie) => cookie.name === "tes_therapist_access_token",
  )?.value;
  expect(accessToken).toBeTruthy();

  const response = await page.request.post(
    "http://127.0.0.1:54321/functions/v1/therapist-profile-command",
    {
      data: { action: "read" },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
    ok?: boolean;
  } | null;

  if (!response.ok() || !payload?.ok) {
    throw new Error(
      `Therapist profile Edge read failed with ${response.status()}: ${typeof payload?.error?.message === "string" ? payload.error.message : "no safe message"}`,
    );
  }
}

async function uploadFromCard(
  page: import("@playwright/test").Page,
  title: string,
  file: { buffer: Buffer; mimeType: string; name: string },
  waitForUpload = true,
) {
  const inputs = page.locator('input[type="file"]');
  const inputCount = await inputs.count();
  if (inputCount !== 2) {
    throw new Error(
      `Expected two document inputs but found ${inputCount}. Visible headings: ${(await page.getByRole("heading").allTextContents()).join(" | ")}`,
    );
  }
  await expect(inputs).toHaveCount(2);
  const input = inputs.nth(title === "Documento de identidade" ? 0 : 1);
  await input.setInputFiles(file);
  if (!waitForUpload) return;
  await expect
    .poll(async () => {
      const document = documentByKind(
        await readDocumentCenter(page),
        documentKindForTitle(title),
      );
      return document.id && document.fileName === file.name;
    })
    .toBe(true);
}

async function readDocumentCenter(page: import("@playwright/test").Page) {
  return await page.evaluate(async () => {
    const response = await fetch("/api/therapist/profile/documents", {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      data?: DocumentCenter | { documentCenter?: DocumentCenter };
      ok?: boolean;
    };
    const documentCenter =
      payload.data &&
      typeof payload.data === "object" &&
      "documentCenter" in payload.data
        ? payload.data.documentCenter
        : payload.data;
    if (!response.ok || !payload.ok || !documentCenter) {
      const message =
        payload && typeof payload === "object" && "error" in payload
          ? (payload as { error?: { message?: unknown } }).error?.message
          : null;
      throw new Error(
        `Unable to read the therapist document center (${response.status}): ${typeof message === "string" ? message : "no safe message"}.`,
      );
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
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: unknown } }
        | null;
      return {
        cacheControl: response.headers.get("cache-control"),
        contentType: response.headers.get("content-type"),
        errorMessage:
          typeof payload?.error?.message === "string"
            ? payload.error.message
            : null,
        location: response.headers.get("location"),
        status: response.status,
        url: response.url,
      };
    },
    { documentId, professionalId },
  );

  expect(response.status, response.errorMessage ?? "no safe error message").toBe(
    200,
  );
  expect(response.contentType).toMatch(/application\/pdf/i);
  expect(response.cacheControl).toMatch(/no-store/i);
  expect(response.location).toBeNull();
  expect(response.url).toMatch(/^http:\/\/localhost:\d+\/api\/admin\//);
}

async function assertSignedUrlExpires({
  documentId,
  page,
}: {
  documentId: string;
  page: import("@playwright/test").Page;
}) {
  const accessToken = (await page.context().cookies()).find(
    (cookie) => cookie.name === "tes_therapist_access_token",
  )?.value;
  expect(accessToken).toBeTruthy();

  const response = await page.request.post(
    "http://127.0.0.1:54321/functions/v1/therapist-private-documents",
    {
      data: {
        action: "therapist.sign",
        disposition: "inline",
        documentId,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  const payload = (await response.json()) as {
    data?: { signedPath?: string };
    ok?: boolean;
  };
  expect(response.ok()).toBe(true);
  const signedPath = payload.data?.signedPath;
  expect(signedPath).toBeTruthy();
  const signedUrl = new URL(signedPath!, "http://127.0.0.1:54321").toString();

  const active = await page.request.get(signedUrl);
  expect(active.status()).toBe(200);
  await page.waitForTimeout(65_000);
  const expired = await page.request.get(signedUrl);
  expect(expired.status()).toBeGreaterThanOrEqual(400);
}

function documentByKind(
  documentCenter: DocumentCenter,
  kind: DocumentCenter["documents"][number]["kind"],
) {
  const document = documentCenter.documents.find((item) => item.kind === kind);
  if (!document) throw new Error(`Missing ${kind} document.`);
  return document;
}

function documentKindForTitle(title: string) {
  return title === "Documento de identidade"
    ? "identity_document"
    : "address_proof";
}

function documentCenterPayloadHasPrivateStorageDetails(
  documentCenter: DocumentCenter,
) {
  return /bucket|object_path|storage_object_path|signedurl|storage\/v1/i.test(
    JSON.stringify(documentCenter),
  );
}

function requiredDocumentId(
  documentCenter: DocumentCenter,
  kind: DocumentCenter["documents"][number]["kind"],
) {
  const id = documentByKind(documentCenter, kind).id;
  if (!id) throw new Error(`Missing id for ${kind}.`);
  return id;
}

function validPdf(name: string, label: string) {
  return {
    buffer: Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj\n<<>>\nendobj\n%%EOF`),
    mimeType: "application/pdf",
    name,
  };
}
