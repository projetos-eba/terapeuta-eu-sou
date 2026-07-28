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

export type TherapistProfileMediaUploadResult = {
  contentType: string;
  kind: TherapistProfileMediaKind;
  publicUrl: string;
  size: number;
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
