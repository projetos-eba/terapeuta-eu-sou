import { expect, test } from "@playwright/test";

const therapistEmail =
  process.env.THERAPIST_DOCUMENTS_E2E_EMAIL ?? "rafael.santos@example.test";
const therapistPassword =
  process.env.THERAPIST_DOCUMENTS_E2E_PASSWORD ?? "tes-mock-password";
const otherTherapistEmail =
  process.env.THERAPIST_DOCUMENTS_OTHER_E2E_EMAIL ??
  "ana.oliveira@example.test";
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
  // The end-to-end check intentionally waits for the 60 s signed-preview TTL
  // after exercising uploads and administrative review through local Storage.
  test.setTimeout(300_000);

  test("stores, protects, reviews and re-requests documents through the real local Storage flow", async ({
    browser,
  }, testInfo) => {
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
      await therapistPage.goto("/terapeuta/configuracoes", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        therapistPage.getByRole("heading", {
          level: 1,
          name: "Configurações",
        }),
      ).toBeVisible();

      // The controlled fixture starts with documents that can be replaced until
      // a decision is recorded by the Admin.
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

      await therapistPage.reload({ waitUntil: "domcontentloaded" });
      documentCenter = await readDocumentCenter(therapistPage);
      expect(documentByKind(documentCenter, "identity_document").id).toBe(
        replacementIdentity.id,
      );
      expect(documentByKind(documentCenter, "address_proof").id).toBe(
        initialAddress.id,
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
      await assertAdminDocumentsResponsiveLayout(adminPage, testInfo);

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
      await expect(therapistPage.getByText("Novo envio")).toBeVisible();
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
      await expect(
        therapistPage.getByLabel("Enviar Documento de identidade"),
      ).toHaveCount(0);
      await expect(
        therapistPage.getByRole("button", { name: "Substituir documento" }),
      ).toHaveCount(0);
      await expect(
        therapistPage.getByRole("button", {
          name: "Enviar novo documento",
        }),
      ).toBeVisible();

      const acceptedReplacementResponse = await therapistPage.evaluate(
        async () => {
          const formData = new FormData();
          formData.set("kind", "identity_document");
          formData.set(
            "file",
            new File(["%PDF-1.4\n%%EOF"], "identidade-bloqueada.pdf", {
              type: "application/pdf",
            }),
          );
          const response = await fetch("/api/therapist/profile/documents", {
            body: formData,
            method: "POST",
          });
          return {
            body: await response.text(),
            status: response.status,
          };
        },
      );
      expect(acceptedReplacementResponse.status).toBe(409);
      expect(acceptedReplacementResponse.body).toMatch(/já foi aprovado/i);

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
  await page.locator('input[name="password"]').fill(therapistPassword);
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

async function assertAdminDocumentsResponsiveLayout(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
) {
  const viewports = [
    { height: 900, label: "desktop", width: 1440 },
    { height: 768, label: "tablet", width: 1024 },
    { height: 844, label: "mobile", width: 390 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("heading", { name: "Documentos enviados" }),
    ).toBeVisible();

    for (const documentTitle of [
      "Documento de identidade",
      "Comprovante de endereço",
    ]) {
      const documentRow = page
        .getByText(documentTitle, { exact: true })
        .locator("xpath=ancestor::li");
      await expect(documentRow).toBeVisible();
      const layout = await documentRow.evaluate((row) => {
        const rowBounds = row.getBoundingClientRect();
        const controls = Array.from(
          row.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>(
            "a, button",
          ),
        )
          .filter((control) => {
            const styles = window.getComputedStyle(control);
            return styles.display !== "none" && styles.visibility !== "hidden";
          })
          .map((control) => control.getBoundingClientRect());
        const controlsStayInside = controls.every(
          (bounds) =>
            bounds.left >= rowBounds.left - 1 &&
            bounds.right <= rowBounds.right + 1 &&
            bounds.top >= rowBounds.top - 1 &&
            bounds.bottom <= rowBounds.bottom + 1,
        );
        const controlsOverlap = controls.some((bounds, index) =>
          controls
            .slice(index + 1)
            .some(
              (other) =>
                bounds.left < other.right &&
                bounds.right > other.left &&
                bounds.top < other.bottom &&
                bounds.bottom > other.top,
            ),
        );

        return {
          controlsOverlap,
          controlsStayInside,
          pageHasHorizontalOverflow:
            document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      expect(layout.controlsStayInside).toBe(true);
      expect(layout.controlsOverlap).toBe(false);
      expect(layout.pageHasHorizontalOverflow).toBe(false);
    }

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(
        `admin-private-documents-${viewport.label}.png`,
      ),
    });
  }

  await page.setViewportSize({ height: 900, width: 1440 });
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  for (let retriesRemaining = 2; retriesRemaining > 0; retriesRemaining -= 1) {
    await page.goto("/admin-login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("E-mail").fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
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

  throw new Error("Admin login did not reach the authenticated endpoint.");
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
  const documentIndex = title === "Documento de identidade" ? 0 : 1;
  const response = await selectDocumentFile(
    page,
    inputs.nth(documentIndex),
    file,
  );
  if (!waitForUpload) return;
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
    ok?: boolean;
  } | null;
  if (!response.ok() || !payload?.ok) {
    throw new Error(
      `Document upload failed with ${response.status()}: ${typeof payload?.error?.message === "string" ? payload.error.message : "no safe message"}`,
    );
  }
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

  throw new Error("Document upload was not started by the profile interface.");
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
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: unknown };
      } | null;
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

  expect(
    response.status,
    response.errorMessage ?? "no safe error message",
  ).toBe(200);
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
  await expect
    .poll(async () => (await page.request.get(signedUrl)).status(), {
      intervals: [1_000, 2_000, 5_000],
      timeout: 70_000,
    })
    .toBeGreaterThanOrEqual(400);
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
