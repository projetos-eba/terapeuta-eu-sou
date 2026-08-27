"use client";

import type {
  PatientAccountData,
  PatientAccountEditableFields,
  PatientAddressLookupResult,
} from "./patient-account.types";

type ApiEnvelope<T> =
  | { data: T; ok: true }
  | { error?: { code?: string; message?: string }; ok: false };

type AccountCommandResult<T> =
  | { data: T; status: "success" }
  | { error: { code: string; message: string; status?: number }; status: "error" };

export type PatientAddressLookupCommandResult =
  | { data: PatientAddressLookupResult; status: "success" }
  | { error: { code: string; message: string; status?: number }; status: "error" };

export async function lookupPatientAddressByCep(
  cep: string,
  signal?: AbortSignal,
): Promise<PatientAddressLookupCommandResult> {
  try {
    const response = await fetch(
      `/api/therapist/address/cep?cep=${encodeURIComponent(cep)}`,
      { cache: "no-store", signal },
    );
    const envelope = (await response
      .json()
      .catch(() => null)) as ApiEnvelope<PatientAddressLookupResult> | null;

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

export async function updatePatientAccount(
  fields: PatientAccountEditableFields,
): Promise<AccountCommandResult<PatientAccountData["account"] & { address: PatientAccountData["address"] }>> {
  try {
    const response = await fetch("/api/patient/account", {
      body: JSON.stringify(fields),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    return parseResponse(response, "Não foi possível salvar seus dados agora.");
  } catch {
    return networkError();
  }
}

export async function changePatientPassword(input: {
  confirmPassword: string;
  password: string;
}): Promise<AccountCommandResult<{ changed: boolean }>> {
  try {
    const response = await fetch("/api/patient/account/password", {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return parseResponse(response, "Não foi possível alterar sua senha agora.");
  } catch {
    return networkError();
  }
}

export async function uploadPatientAvatar(
  file: File,
): Promise<AccountCommandResult<{ avatarUrl: string }>> {
  const formData = new FormData();
  formData.set("file", file);

  try {
    const response = await fetch("/api/patient/account/avatar", {
      body: formData,
      cache: "no-store",
      method: "POST",
    });
    return parseResponse(response, "Não foi possível enviar sua foto agora.");
  } catch {
    return networkError();
  }
}

async function parseResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<AccountCommandResult<T>> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || payload.ok !== true) {
    const error = payload?.ok === false ? payload.error : undefined;
    return {
      error: {
        code: error?.code ?? "UNKNOWN",
        message: error?.message ?? fallbackMessage,
        status: response.status,
      },
      status: "error",
    };
  }
  return { data: payload.data, status: "success" };
}

function networkError<T>(): AccountCommandResult<T> {
  return {
    error: {
      code: "NETWORK_ERROR",
      message: "Não foi possível conectar agora. Tente novamente.",
    },
    status: "error",
  };
}
