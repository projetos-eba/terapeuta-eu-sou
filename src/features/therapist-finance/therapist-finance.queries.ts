import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { TherapistFinanceError } from "./therapist-finance.errors";

type QueryBody = Record<string, unknown>;

export function queryTherapistFinancialOverview(
  accessToken: string,
  body: QueryBody,
) {
  return requestFinanceRpc("get_private_therapist_financial_overview_v2", {
    accessToken,
    body,
  });
}

export function queryTherapistReceipts(accessToken: string, body: QueryBody) {
  return requestFinanceRpc("get_private_therapist_receipts_v2", {
    accessToken,
    body,
  });
}

export function queryTherapistPayouts(accessToken: string, body: QueryBody) {
  return requestFinanceRpc("get_private_therapist_payouts_v2", {
    accessToken,
    body,
  });
}

export function queryTherapistConnectAccount(accessToken: string) {
  return requestFinanceRpc("get_private_therapist_connect_account_v1", {
    accessToken,
    body: {},
  });
}

export function queryTherapistFinancialMetrics(
  accessToken: string,
  body: QueryBody,
) {
  return requestFinanceRpc("get_private_therapist_financial_metrics_v1", {
    accessToken,
    body,
  });
}

export function queryTherapistAdvancedFinancialDashboard(
  accessToken: string,
  body: QueryBody,
) {
  return requestFinanceRpc(
    "get_private_therapist_advanced_financial_dashboard_v1",
    {
      accessToken,
      body,
    },
  );
}

async function requestFinanceRpc(
  rpc: string,
  {
    accessToken,
    body,
  }: {
    accessToken: string;
    body: QueryBody;
  },
) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistFinanceError("unavailable");

  const response = await fetch(
    `${config.url}/rest/v1/rpc/${encodeURIComponent(rpc)}`,
    {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (response.status === 401) {
    throw new TherapistFinanceError("session_expired");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw mapRpcError(response.status, payload);
  }

  return (await response.json()) as unknown;
}

function mapRpcError(status: number, payload: unknown) {
  const message =
    isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : "";

  if (message === "VALIDATION_ERROR") {
    return new TherapistFinanceError("validation_error");
  }

  if (
    status === 403 ||
    message === "FORBIDDEN" ||
    message === "PROFILE_LOCKED" ||
    message === "PROFILE_NOT_FOUND"
  ) {
    return new TherapistFinanceError("forbidden");
  }

  return new TherapistFinanceError("unavailable");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
