import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import {
  mapAdminProfessionalDocumentReviewData,
  mapTherapistDocumentCenterData,
} from "./private-documents.mappers";
import type {
  AdminProfessionalDocumentReviewData,
  TherapistDocumentCenterData,
} from "./private-documents.types";

type EdgeEnvelope<T> =
  | { data: T; ok: true }
  | { error?: { message?: string; requestId?: string }; ok: false };

export type TherapistDocumentCenterResult =
  | { data: TherapistDocumentCenterData; status: "success" }
  | { message: string; requestId?: string; status: "error" };

export type AdminProfessionalDocumentReviewResult =
  | { data: AdminProfessionalDocumentReviewData; status: "success" }
  | { message: string; requestId?: string; status: "error" };

export const getTherapistDocumentCenter = cache(
  async function getTherapistDocumentCenter({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<TherapistDocumentCenterResult> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Configuração Supabase ausente para carregar documentos.",
        status: "error",
      };
    }

    try {
      const data = await callPrivateDocumentsEdge<unknown>(
        config.url,
        accessToken,
        { action: "therapist.read" },
      );

      return {
        data: mapTherapistDocumentCenterData(data),
        status: "success",
      };
    } catch (error) {
      return normalizeError(error, "Não foi possível carregar os documentos agora.");
    }
  },
);

export const getAdminProfessionalDocumentReview = cache(
  async function getAdminProfessionalDocumentReview({
    accessToken,
    therapistProfileId,
  }: {
    accessToken: string;
    therapistProfileId: string;
  }): Promise<AdminProfessionalDocumentReviewResult> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Configuração Supabase ausente para carregar documentos.",
        status: "error",
      };
    }

    try {
      const data = await callPrivateDocumentsEdge<unknown>(
        config.url,
        accessToken,
        {
          action: "admin.read",
          therapistProfileId,
        },
      );

      return {
        data: mapAdminProfessionalDocumentReviewData(data),
        status: "success",
      };
    } catch (error) {
      return normalizeError(
        error,
        "Não foi possível carregar os documentos privados agora.",
      );
    }
  },
);

async function callPrivateDocumentsEdge<T>(
  supabaseUrl: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/therapist-private-documents`,
    {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response.json().catch(() => null)) as EdgeEnvelope<T>;

  if (!response.ok || !payload?.ok) {
    throw (
      payload ?? {
        error: {
          message: "Não foi possível concluir esta leitura agora.",
        },
        ok: false,
      }
    );
  }

  return payload.data;
}

function normalizeError(error: unknown, fallbackMessage: string) {
  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    error.error &&
    typeof error.error === "object"
  ) {
    const payload = error.error as { message?: string; requestId?: string };

    return {
      message: payload.message || fallbackMessage,
      requestId: payload.requestId,
      status: "error" as const,
    };
  }

  return {
    message: fallbackMessage,
    status: "error" as const,
  };
}
