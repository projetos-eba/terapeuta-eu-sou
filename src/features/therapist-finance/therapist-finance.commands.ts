"use client";

import type { TherapistFinanceConnectAction } from "./therapist-finance.types";

type ConnectApiEnvelope =
  | {
      data: {
        accountClosed?: boolean;
        message?: string;
        onboardingStatus?: string;
        transferCapabilityStatus?: string;
        url?: string;
      };
      ok: true;
    }
  | {
      error?: {
        code?: string;
        message?: string;
        requestId?: string;
      };
      ok: false;
    };

export type TherapistFinanceConnectResult =
  | {
      data: {
        accountClosed?: boolean;
        message?: string;
        onboardingStatus?: string;
        transferCapabilityStatus?: string;
        url?: string;
      };
      status: "success";
    }
  | {
      error: {
        message: string;
        requestId?: string;
        status?: number;
      };
      status: "error";
    };

export async function sendTherapistFinanceConnectCommand(
  action: TherapistFinanceConnectAction,
): Promise<TherapistFinanceConnectResult> {
  try {
    const response = await fetch("/api/therapist/finance/connect", {
      body: JSON.stringify({ action }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ConnectApiEnvelope | null;

    if (!response.ok || !payload?.ok) {
      return {
        error: {
          message:
            payload?.ok === false && payload.error?.message
              ? payload.error.message
              : "Não foi possível conectar sua conta de recebimento agora.",
          requestId:
            payload?.ok === false ? payload.error?.requestId : undefined,
          status: response.status,
        },
        status: "error",
      };
    }

    return {
      data: payload.data,
      status: "success",
    };
  } catch {
    return {
      error: {
        message: "Não foi possível conectar agora. Tente novamente.",
      },
      status: "error",
    };
  }
}
