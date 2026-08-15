"use client";

import {
  normalizeTherapistProfileError,
  type TherapistProfileApiError,
} from "./therapist-profile-editor.errors";
import {
  mapTherapistProfileEditorContract,
  mapTherapistProfileMutationResult,
} from "./therapist-profile-editor.mappers";
import type {
  TherapistProfileCommand,
  TherapistProfileEditorData,
  TherapistProfileMutationResult,
  TherapistPrivateDocumentSummary,
  TherapistProfileVerificationStatus,
} from "./therapist-profile-editor.types";

type ApiEnvelope<T> =
  | { data: T; ok: true }
  | {
      error?: {
        code?: string;
        message?: string;
        requestId?: string;
      };
      ok: false;
    };

export type TherapistProfileCommandResult<T> =
  | { data: T; status: "success" }
  | { error: TherapistProfileApiError; status: "error" };

export type TherapistProfileMediaKind = "photo" | "video" | "video_thumbnail";
export type TherapistPrivateDocumentKind =
  | "address_proof"
  | "identity_document";

export type TherapistProfileMediaUploadResult = {
  contentType: string;
  kind: TherapistProfileMediaKind;
  publicUrl: string;
  size: number;
};

export type TherapistPrivateDocumentUploadResult = {
  documents: TherapistPrivateDocumentSummary[];
  verificationStatus: TherapistProfileVerificationStatus;
};

export async function sendTherapistProfileCommand(
  command: TherapistProfileCommand,
): Promise<
  TherapistProfileCommandResult<
    TherapistProfileEditorData | TherapistProfileMutationResult
  >
> {
  try {
    const response = await fetch("/api/therapist/profile", {
      body: JSON.stringify(command),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<unknown>;

    if (!response.ok || !payload?.ok) {
      return {
        error: {
          ...normalizeTherapistProfileError(payload),
          status: response.status,
        },
        status: "error",
      };
    }

    return {
      data:
        command.action === "read"
          ? mapTherapistProfileEditorContract(payload.data)
          : mapTherapistProfileMutationResult(payload.data),
      status: "success",
    };
  } catch {
    return {
      error: {
        code: "network_error",
        message: "Não foi possível conectar agora. Tente novamente.",
      },
      status: "error",
    };
  }
}

export function createStableRequestId() {
  return crypto.randomUUID();
}

export async function uploadTherapistProfileMedia({
  file,
  kind,
}: {
  file: File;
  kind: TherapistProfileMediaKind;
}): Promise<TherapistProfileCommandResult<TherapistProfileMediaUploadResult>> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("kind", kind);

  try {
    const response = await fetch("/api/therapist/profile/media", {
      body: formData,
      cache: "no-store",
      method: "POST",
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<unknown> | null;

    if (!response.ok || !payload?.ok) {
      return {
        error: {
          ...normalizeTherapistProfileError(payload),
          status: response.status,
        },
        status: "error",
      };
    }

    const data = payload.data as Partial<TherapistProfileMediaUploadResult>;
    if (
      typeof data.publicUrl !== "string" ||
      typeof data.contentType !== "string" ||
      typeof data.size !== "number" ||
      (data.kind !== "photo" &&
        data.kind !== "video" &&
        data.kind !== "video_thumbnail")
    ) {
      return {
        error: {
          code: "unknown",
          message: "Não foi possível validar o arquivo enviado.",
        },
        status: "error",
      };
    }

    return {
      data: {
        contentType: data.contentType,
        kind: data.kind,
        publicUrl: data.publicUrl,
        size: data.size,
      },
      status: "success",
    };
  } catch {
    return {
      error: {
        code: "network_error",
        message: "Não foi possível enviar o arquivo agora. Tente novamente.",
      },
      status: "error",
    };
  }
}

export async function uploadTherapistPrivateDocument({
  file,
  kind,
}: {
  file: File;
  kind: TherapistPrivateDocumentKind;
}): Promise<
  TherapistProfileCommandResult<TherapistPrivateDocumentUploadResult>
> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("kind", kind);

  try {
    const response = await fetch("/api/therapist/profile/documents", {
      body: formData,
      cache: "no-store",
      method: "POST",
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<unknown> | null;

    if (!response.ok || !payload?.ok) {
      return {
        error: {
          ...normalizeTherapistProfileError(payload),
          status: response.status,
        },
        status: "error",
      };
    }

    const data = mapPrivateDocumentUploadPayload(payload.data);

    if (!data) {
      return {
        error: {
          code: "unknown",
          message: "Não foi possível validar o documento enviado.",
        },
        status: "error",
      };
    }

    return {
      data,
      status: "success",
    };
  } catch {
    return {
      error: {
        code: "network_error",
        message: "Não foi possível enviar o documento agora. Tente novamente.",
      },
      status: "error",
    };
  }
}

function mapPrivateDocumentUploadPayload(
  value: unknown,
): TherapistPrivateDocumentUploadResult | null {
  if (!value || typeof value !== "object") return null;

  const documentCenter = (value as { documentCenter?: unknown }).documentCenter;
  if (!documentCenter || typeof documentCenter !== "object") return null;

  const payload = documentCenter as {
    documents?: unknown;
    verificationStatus?: unknown;
  };
  if (!Array.isArray(payload.documents)) return null;

  const documents = payload.documents.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const document = item as Record<string, unknown>;
    if (
      typeof document.id !== "string" ||
      (document.kind !== "identity_document" &&
        document.kind !== "address_proof") ||
      typeof document.fileName !== "string" ||
      typeof document.mimeType !== "string" ||
      typeof document.sizeBytes !== "number" ||
      typeof document.uploadedAt !== "string" ||
      (document.status !== "accepted" &&
        document.status !== "rejected" &&
        document.status !== "uploaded") ||
      (document.validationState !== "failed" &&
        document.validationState !== "not_scanned" &&
        document.validationState !== "passed" &&
        document.validationState !== "pending")
    ) {
      return [];
    }

    return [
      {
        createdAt: document.uploadedAt,
        fileName: document.fileName,
        fileSizeBytes: document.sizeBytes,
        id: document.id,
        kind: document.kind,
        mimeType: document.mimeType,
        reviewNote:
          typeof document.reviewNote === "string" && document.reviewNote.trim()
            ? document.reviewNote
            : null,
        reviewedAt:
          typeof document.reviewedAt === "string" ? document.reviewedAt : null,
        status: document.status,
        updatedAt: document.uploadedAt,
        validationState: document.validationState,
      } satisfies TherapistPrivateDocumentSummary,
    ];
  });

  const verificationStatus = payload.verificationStatus;
  if (
    verificationStatus !== "approved" &&
    verificationStatus !== "changes_requested" &&
    verificationStatus !== "draft" &&
    verificationStatus !== "in_review" &&
    verificationStatus !== "none" &&
    verificationStatus !== "rejected" &&
    verificationStatus !== "submitted" &&
    verificationStatus !== "suspended"
  ) {
    return null;
  }

  return { documents, verificationStatus };
}
