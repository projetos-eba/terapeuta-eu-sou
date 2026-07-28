import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { parseAdminTherapyCatalogContract } from "./admin-therapy-catalog.parsers";
import type { AdminTherapyCatalogContract } from "./admin-therapy-catalog.types";

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

export type AdminTherapyCatalogPageResult =
  | {
      catalog: AdminTherapyCatalogContract;
      status: "success";
    }
  | {
      message: string;
      requestId?: string;
      status: "error";
    };

export const getAdminTherapyCatalogPage = cache(
  async function getAdminTherapyCatalogPage({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<AdminTherapyCatalogPageResult> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Configuração Supabase ausente para carregar o catálogo.",
        status: "error",
      };
    }

    try {
      const payload = await callAdminTherapyCatalogEdge<unknown>(
        config.url,
        accessToken,
        { action: "list" },
      );

      return {
        catalog: parseAdminTherapyCatalogContract(payload),
        status: "success",
      };
    } catch (error) {
      return {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o catálogo agora.",
        status: "error",
      };
    }
  },
);

async function callAdminTherapyCatalogEdge<T>(
  supabaseUrl: string,
  accessToken: string,
  body: { action: "list" },
) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/admin-therapy-catalog-command`,
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
    throw new Error(
      payload && !payload.ok
        ? (payload.error?.message ?? "Falha ao carregar catálogo.")
        : "Falha ao carregar catálogo.",
    );
  }

  return payload.data;
}
