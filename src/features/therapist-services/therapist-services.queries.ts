import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { normalizeTherapistServicesError } from "./therapist-services.errors";
import {
  mapTherapistServicesContract,
  mapTherapyCatalogContract,
} from "./therapist-services.mappers";
import type {
  TherapistServicesContract,
  TherapyCatalogContract,
} from "./therapist-services.types";

type TherapistServicesPageInput = {
  accessToken: string;
};

export type TherapistServicesPageResult =
  | {
      catalog: TherapyCatalogContract;
      services: TherapistServicesContract;
      status: "success";
    }
  | {
      message: string;
      requestId?: string;
      status: "error";
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

export const getTherapistServicesPage = cache(
  async function getTherapistServicesPage({
    accessToken,
  }: TherapistServicesPageInput): Promise<TherapistServicesPageResult> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Não foi possível carregar suas terapias agora.",
        status: "error",
      };
    }

    try {
      const [services, catalog] = await Promise.all([
        callTherapistServicesEdge<unknown>(config.url, accessToken, {
          action: "list",
        }),
        callTherapistServicesEdge<unknown>(config.url, accessToken, {
          action: "catalog",
        }),
      ]);

      return {
        catalog: mapTherapyCatalogContract(catalog),
        services: mapTherapistServicesContract(services),
        status: "success",
      };
    } catch (error) {
      const normalized = normalizeTherapistServicesError(error);

      return {
        message: normalized.message,
        requestId: normalized.requestId,
        status: "error",
      };
    }
  },
);

async function callTherapistServicesEdge<T>(
  supabaseUrl: string,
  accessToken: string,
  body: { action: "catalog" | "list" },
) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/therapist-services-command`,
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
        ok: false,
        error: {
          message: "Não foi possível carregar suas terapias agora.",
        },
      }
    );
  }

  return payload.data;
}
