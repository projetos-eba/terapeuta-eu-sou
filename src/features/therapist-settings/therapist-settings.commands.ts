"use client";

import type {
  TherapistAddressLookupResult,
  TherapistSettingsUpdatePayload,
  TherapistSettingsUpdateResult,
} from "./therapist-settings.types";

type ApiEnvelope<T> =
  | { data: T; ok: true }
  | {
      error?: {
        code?: string;
        message?: string;
      };
      ok: false;
    };

export type TherapistSettingsCommandResult =
  | { data: TherapistSettingsUpdateResult; status: "success" }
  | {
      error: { code: string; message: string; status?: number };
      status: "error";
    };

export type TherapistAddressLookupCommandResult =
  | { data: TherapistAddressLookupResult; status: "success" }
  | { error: { code: string; message: string; status?: number }; status: "error" };

export async function updateTherapistSettings(
  payload: TherapistSettingsUpdatePayload,
): Promise<TherapistSettingsCommandResult> {
  try {
    const response = await fetch("/api/therapist/settings", {
      body: JSON.stringify(payload),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const envelope = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<TherapistSettingsUpdateResult> | null;

    if (!response.ok || !envelope || envelope.ok !== true) {
      const error = envelope?.ok === false ? envelope.error : undefined;
      return {
        error: {
          code: error?.code ?? "UNKNOWN",
          message:
            error?.message ??
            "Não foi possível salvar as configurações agora.",
          status: response.status,
        },
        status: "error",
      };
    }

    return { data: envelope.data, status: "success" };
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível conectar agora. Tente novamente.",
      },
      status: "error",
    };
  }
}

export async function lookupTherapistAddressByCep(
  cep: string,
  signal?: AbortSignal,
): Promise<TherapistAddressLookupCommandResult> {
  try {
    const response = await fetch(
      `/api/therapist/address/cep?cep=${encodeURIComponent(cep)}`,
      { cache: "no-store", signal },
    );
    const envelope = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<TherapistAddressLookupResult> | null;

    if (!response.ok || !envelope || envelope.ok !== true) {
      const error = envelope?.ok === false ? envelope.error : undefined;
      return {
        error: {
          code: error?.code ?? "CEP_UNAVAILABLE",
          message:
            error?.message ??
            "Não foi possível consultar este CEP. Você pode preencher o endereço manualmente.",
          status: response.status,
        },
        status: "error",
      };
    }

    return { data: envelope.data, status: "success" };
  } catch {
    return {
      error: {
        code: "CEP_UNAVAILABLE",
        message:
          "Não foi possível consultar este CEP. Você pode preencher o endereço manualmente.",
      },
      status: "error",
    };
  }
}
