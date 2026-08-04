"use client";

import { parseAdminMatchingContract } from "./admin-matching.parsers";
import type {
  AdminMatchingContract,
  AdminMatchingInterestCommand,
  AdminMatchingThemeCommand,
} from "./admin-matching.types";

type AdminMatchingCommand =
  | { action: "matchingList" }
  | {
      action: "matchingSaveTheme";
      payload: AdminMatchingThemeCommand;
      requestId: string;
    }
  | {
      action: "matchingSaveInterest";
      payload: AdminMatchingInterestCommand;
      requestId: string;
    }
  | {
      action: "matchingTransition";
      entityId: string;
      entityType: "theme" | "interest";
      matchingAction: "activate" | "deactivate";
      reason: string;
      requestId: string;
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

export type AdminMatchingCommandResult =
  | {
      matching: AdminMatchingContract;
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

export async function sendAdminMatchingCommand(
  command: AdminMatchingCommand,
): Promise<AdminMatchingCommandResult> {
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
              ? (payload.error?.message ?? "Não foi possível atualizar o Match.")
              : "Não foi possível atualizar o Match.",
          requestId:
            payload && !payload.ok ? payload.error?.requestId : undefined,
        },
        status: "error",
      };
    }

    return {
      matching: parseAdminMatchingContract(payload.data),
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
