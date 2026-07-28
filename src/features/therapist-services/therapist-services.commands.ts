"use client";

import {
  normalizeTherapistServicesError,
  type TherapistServicesApiError,
} from "./therapist-services.errors";
import {
  mapTherapistServiceMutationResult,
  mapTherapistServicesContract,
  mapTherapyCatalogContract,
} from "./therapist-services.mappers";
import type {
  TherapistServiceMutationResult,
  TherapistServicesCommand,
  TherapistServicesContract,
  TherapyCatalogContract,
} from "./therapist-services.types";

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

export type TherapistServicesCommandResult<T> =
  | { data: T; status: "success" }
  | { error: TherapistServicesApiError; status: "error" };

export async function sendTherapistServicesCommand(
  command: TherapistServicesCommand,
): Promise<
  TherapistServicesCommandResult<
    | TherapistServiceMutationResult
    | TherapistServicesContract
    | TherapyCatalogContract
  >
> {
  try {
    const response = await fetch("/api/therapist/services", {
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
          ...normalizeTherapistServicesError(payload),
          status: response.status,
        },
        status: "error",
      };
    }

    return {
      data: mapCommandData(command.action, payload.data),
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

function mapCommandData(
  action: TherapistServicesCommand["action"],
  data: unknown,
) {
  if (action === "catalog") return mapTherapyCatalogContract(data);
  if (action === "list" || action === "reorder") {
    return mapTherapistServicesContract(data);
  }
  return mapTherapistServiceMutationResult(data);
}

export function createStableRequestId() {
  return crypto.randomUUID();
}
