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
