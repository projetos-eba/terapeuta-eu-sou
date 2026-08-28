import { DomainError } from "../_shared/payments/http.ts";
import {
  fileExtension,
  parseTherapistPrivateDocumentsAction as parseAction,
  validatePrivateDocumentUpload as validateUpload,
} from "./document-command.ts";

Deno.test(
  "accepts therapist private document upload with supported file",
  async () => {
    const formData = new FormData();
    formData.set("action", "therapist.upload");
    formData.set(
      "file",
      new File(
        [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])],
        "rg.pdf",
        { type: "application/pdf" },
      ),
    );
    formData.set("kind", "identity_document");

    const action = await parseAction(
      new Request("https://tes.local/private-documents", {
        body: formData,
        method: "POST",
      }),
    );

    if (action.action !== "therapist.upload") {
      throw new Error("Expected upload action.");
    }

    await validateUpload(action.file);
  },
);

Deno.test(
  "rejects unsupported therapist private document payloads",
  async () => {
    let uploadError: unknown = null;
    try {
      await validateUpload(
        new File(["not-a-pdf"], "rg.pdf", { type: "application/pdf" }),
      );
    } catch (error) {
      uploadError = error;
    }

    if (!(uploadError instanceof DomainError)) {
      throw new Error("Expected invalid document content to fail validation.");
    }

    let parseError: unknown = null;
    try {
      await parseAction(
        new Request("https://tes.local/private-documents", {
          body: JSON.stringify({ action: "admin.sign", disposition: "inline" }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );
    } catch (error) {
      parseError = error;
    }

    if (!(parseError instanceof DomainError)) {
      throw new Error("Expected invalid admin sign payload to fail parsing.");
    }

    if (fileExtension("application/pdf") !== ".pdf") {
      throw new Error("Expected pdf extension.");
    }
  },
);

Deno.test("explains the 10 MB private document limit", async () => {
  let uploadError: unknown = null;
  try {
    await validateUpload(
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "documento.pdf", {
        type: "application/pdf",
      }),
    );
  } catch (error) {
    uploadError = error;
  }

  if (!(uploadError instanceof DomainError)) {
    throw new Error("Expected oversized document to fail validation.");
  }

  if (
    uploadError.message !==
    "Não foi possível concluir a operação, o tamanho do documento excede o limite de 10 MB."
  ) {
    throw new Error("Expected explicit 10 MB document limit message.");
  }
});
