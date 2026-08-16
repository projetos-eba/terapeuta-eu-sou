import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { parseAdminMatchingContract } from "./admin-matching.parsers";
import type { AdminMatchingContract } from "./admin-matching.types";

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

export type AdminMatchingPageResult =
  | {
      matching: AdminMatchingContract;
      status: "success";
    }
  | {
      message: string;
      requestId?: string;
      status: "error";
    };

export const getAdminMatchingPage = cache(async function getAdminMatchingPage({
  accessToken,
}: {
  accessToken: string;
}): Promise<AdminMatchingPageResult> {
  const config = getSupabasePublicConfig();

  if (!config) {
    return {
      message: "Não foi possível carregar o Match agora.",
      status: "error",
    };
  }

  try {
    const response = await fetch(
      `${config.url}/functions/v1/admin-therapy-catalog-command`,
      {
        body: JSON.stringify({ action: "matchingList" }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    const payload = (await response.json().catch(() => null)) as EdgeEnvelope<unknown>;

    if (!response.ok || !payload?.ok) {
      return {
        message:
          payload && !payload.ok
            ? (payload.error?.message ?? "Não foi possível carregar o Match.")
            : "Não foi possível carregar o Match.",
        requestId: payload && !payload.ok ? payload.error?.requestId : undefined,
        status: "error",
      };
    }

    return {
      matching: parseAdminMatchingContract(payload.data),
      status: "success",
    };
  } catch {
    return {
      message: "Não foi possível carregar o Match agora.",
      status: "error",
    };
  }
});
