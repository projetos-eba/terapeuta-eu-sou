import { DomainError } from "../_shared/payments/http.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const supportedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const requiredDocumentDefinitions = {
  address_proof: {
    description: "Envie um comprovante recente emitido nos últimos 90 dias.",
    helper: "Conta de luz, água, telefone ou documento equivalente.",
    title: "Comprovante de endereço",
  },
  identity_document: {
    description: "Envie um documento oficial com foto e boa legibilidade.",
    helper: "RG, CNH ou passaporte com foto.",
    title: "Documento de identidade",
  },
} as const;

export type TherapistPrivateDocumentKind =
  keyof typeof requiredDocumentDefinitions;

export type TherapistPrivateDocumentsAction =
  | { action: "admin.read"; therapistProfileId: string }
  | {
      action: "admin.review";
      decision: "accepted" | "resubmission_requested";
      documentId: string;
      reason: string | null;
      therapistProfileId: string;
    }
  | {
      action: "admin.sign";
      disposition: "attachment" | "inline";
      documentId: string;
      therapistProfileId: string;
    }
  | { action: "therapist.read" }
  | {
      action: "therapist.sign";
      disposition: "attachment" | "inline";
      documentId: string;
    }
  | {
      action: "therapist.upload";
      file: File;
      kind: TherapistPrivateDocumentKind;
    };

export async function parseTherapistPrivateDocumentsAction(
  request: Request,
): Promise<TherapistPrivateDocumentsAction> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) invalid();

    const action = formData.get("action");
    const kind = formData.get("kind");
    const file = formData.get("file");

    if (
      action !== "therapist.upload" ||
      !isDocumentKind(kind) ||
      !isUploadedFile(file)
    ) {
      invalid();
    }

    return {
      action,
      file,
      kind,
    };
  }

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!payload || typeof payload.action !== "string") invalid();

  if (payload.action === "therapist.read") {
    return { action: payload.action };
  }

  if (payload.action === "admin.read") {
    return {
      action: payload.action,
      therapistProfileId: boundedUuid(payload.therapistProfileId),
    };
  }

  if (payload.action === "admin.review") {
    const decision = documentReviewDecision(payload.decision);
    const reason = optionalReason(payload.reason);

    if (decision === "resubmission_requested" && !reason) invalid();

    return {
      action: payload.action,
      decision,
      documentId: boundedUuid(payload.documentId),
      reason,
      therapistProfileId: boundedUuid(payload.therapistProfileId),
    };
  }

  if (payload.action === "therapist.sign") {
    return {
      action: payload.action,
      disposition: disposition(payload.disposition),
      documentId: boundedUuid(payload.documentId),
    };
  }

  if (payload.action === "admin.sign") {
    return {
      action: payload.action,
      disposition: disposition(payload.disposition),
      documentId: boundedUuid(payload.documentId),
      therapistProfileId: boundedUuid(payload.therapistProfileId),
    };
  }

  invalid();
}

export async function validatePrivateDocumentUpload(file: File) {
  if (!supportedMimeTypes.has(file.type)) {
    throw new DomainError(
      "VALIDATION_ERROR",
      422,
      "Envie um arquivo em PDF, JPG ou PNG.",
    );
  }

  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new DomainError(
      "VALIDATION_ERROR",
      422,
      "Não foi possível concluir a operação, o tamanho do documento excede o limite de 10 MB.",
    );
  }

  if (!(await hasValidPrivateDocumentSignature(file))) {
    throw new DomainError(
      "VALIDATION_ERROR",
      422,
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
  }
}

export function fileExtension(contentType: string) {
  if (contentType === "application/pdf") return ".pdf";
  if (contentType === "image/png") return ".png";
  return ".jpg";
}

export function requiredDocumentDefinition(kind: TherapistPrivateDocumentKind) {
  return requiredDocumentDefinitions[kind];
}

function boundedUuid(value: unknown) {
  if (typeof value !== "string" || !UUID.test(value)) invalid();
  return value;
}

function disposition(value: unknown) {
  return value === "attachment" ? "attachment" : "inline";
}

function documentReviewDecision(value: unknown) {
  if (value === "accepted" || value === "resubmission_requested") {
    return value;
  }
  invalid();
}

function optionalReason(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") invalid();

  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 1000) invalid();
  return normalized;
}

async function hasValidPrivateDocumentSignature(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  switch (file.type) {
    case "application/pdf":
      return hasAscii(bytes, 0, "%PDF-");
    case "image/jpeg":
      return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    default:
      return false;
  }
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function hasAscii(bytes: Uint8Array, offset: number, value: string) {
  return Array.from(value).every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  );
}

function isDocumentKind(value: unknown): value is TherapistPrivateDocumentKind {
  return value === "identity_document" || value === "address_proof";
}

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).name === "string" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).type === "string"
  );
}

function invalid(): never {
  throw new DomainError(
    "VALIDATION_ERROR",
    422,
    "Revise os dados do documento antes de continuar.",
  );
}
