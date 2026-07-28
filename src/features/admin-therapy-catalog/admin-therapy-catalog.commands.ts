"use client";

import { parseAdminTherapyCatalogContract } from "./admin-therapy-catalog.parsers";
import type {
  AdminTherapyCatalogContract,
  AdminTherapyDraftCommand,
  AdminTherapyTransition,
} from "./admin-therapy-catalog.types";

type AdminCommand =
  | { action: "list" }
  | {
      action: "save";
      payload: AdminTherapyDraftCommand;
      requestId: string;
    }
  | {
      action: "transition";
      payload?: Record<string, unknown>;
      reason: string;
      requestId: string;
      therapyId: string;
      transition: AdminTherapyTransition;
    }
  | {
      action: "decideRequest";
      catalogRequestId: string;
      decision: string;
      relatedTherapyId?: string | null;
      requestId: string;
      status: string;
    };

type ApiEnvelope =
  | { data: unknown; ok: true }
  | {
      error?: {
        code?: string;
        message?: string;
        requestId?: string;
      };
      ok: false;
    };

export type AdminTherapyCatalogCommandResult =
  | {
      catalog: AdminTherapyCatalogContract;
      status: "success";
    }
  | {
      error: {
        code: string;
        message: string;
        requestId?: string;
      };
      status: "error";
    };

export async function sendAdminTherapyCatalogCommand(
  command: AdminCommand,
): Promise<AdminTherapyCatalogCommandResult> {
  try {
    const response = await fetch("/api/admin/therapies", {
      body: JSON.stringify(command),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope;

    if (!response.ok || !payload?.ok) {
      return {
        error: {
          code:
            payload && !payload.ok ? (payload.error?.code ?? "error") : "error",
          message:
            payload && !payload.ok
              ? (payload.error?.message ?? "Não foi possível atualizar.")
              : "Não foi possível atualizar.",
          requestId:
            payload && !payload.ok ? payload.error?.requestId : undefined,
        },
        status: "error",
      };
    }

    return {
      catalog: parseAdminTherapyCatalogContract(extractCatalog(payload.data)),
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

function extractCatalog(data: unknown) {
  if (isRecord(data) && isRecord(data.catalog)) return data.catalog;
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
