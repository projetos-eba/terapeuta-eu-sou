import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { normalizeTherapistProfileError } from "./therapist-profile-editor.errors";
import { mapTherapistProfileEditorContract } from "./therapist-profile-editor.mappers";
import type { TherapistProfileEditorData } from "./therapist-profile-editor.types";

type TherapistProfilePageInput = {
  accessToken: string;
};

type EdgeEnvelope<T> =
  | { data: T; ok: true }
  | {
      error?: {
        code?: string;
        message?: string;
        requestId?: string;
      };
      ok: false;
    };

export type TherapistProfilePageResult =
  | {
      editor: TherapistProfileEditorData;
      status: "success";
    }
  | {
      message: string;
      requestId?: string;
      status: "error";
    };

export const getTherapistProfileEditorPage = cache(
  async function getTherapistProfileEditorPage({
    accessToken,
  }: TherapistProfilePageInput): Promise<TherapistProfilePageResult> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Não foi possível carregar seu perfil agora.",
        status: "error",
      };
    }

    try {
      const data = await callTherapistProfileEdge<unknown>(
        config.url,
        accessToken,
        { action: "read" },
      );

      return {
        editor: mapTherapistProfileEditorContract(data),
        status: "success",
      };
    } catch (error) {
      const normalized = normalizeTherapistProfileError(error);
      return {
        message: normalized.message,
        requestId: normalized.requestId,
        status: "error",
      };
    }
  },
);

async function callTherapistProfileEdge<T>(
  supabaseUrl: string,
  accessToken: string,
  body: { action: "read" },
) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/therapist-profile-command`,
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
          message: "Não foi possível carregar o perfil agora.",
        },
        ok: false,
      }
    );
  }

  return payload.data;
}
