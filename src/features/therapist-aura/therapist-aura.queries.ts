import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { TherapistAuraError } from "./therapist-aura.errors";

export async function queryTherapistAuraSignals(
  accessToken: string,
  periodDays: 30 | 90,
) {
  return requestAuraRpc(accessToken, "get_therapist_aura_signals_v1", {
    p_period_days: periodDays,
  });
}

export async function dismissTherapistAuraSignal({
  accessToken,
  periodEnd,
  periodStart,
  recommendationKey,
  requestId,
  ruleKey,
  ruleVersion,
}: {
  accessToken: string;
  periodEnd: string;
  periodStart: string;
  recommendationKey: string;
  requestId: string;
  ruleKey: string;
  ruleVersion: number;
}) {
  return requestAuraRpc(accessToken, "dismiss_therapist_aura_signal_v1", {
    p_period_end: periodEnd,
    p_period_start: periodStart,
    p_recommendation_key: recommendationKey,
    p_request_id: requestId,
    p_rule_key: ruleKey,
    p_rule_version: ruleVersion,
  });
}

async function requestAuraRpc(
  accessToken: string,
  rpc: "dismiss_therapist_aura_signal_v1" | "get_therapist_aura_signals_v1",
  body: Record<string, unknown>,
) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistAuraError("unavailable");

  const response = await fetch(`${config.url}/rest/v1/rpc/${rpc}`, {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 401) {
    throw new TherapistAuraError("session_expired");
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

  if (
    status === 403 ||
    message === "CAPABILITY_NOT_ALLOWED" ||
    message === "FORBIDDEN" ||
    message === "PROFILE_LOCKED" ||
    message === "PROFILE_NOT_FOUND" ||
    message === "RECOMMENDATION_NOT_FOUND"
  ) {
    return new TherapistAuraError("forbidden");
  }

  return new TherapistAuraError("unavailable");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
