import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { TherapistMetricsError } from "./therapist-metrics.errors";

export async function queryTherapistMetricsFoundation(accessToken: string) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistMetricsError("unavailable");

  const response = await fetch(
    `${config.url}/rest/v1/rpc/get_therapist_metrics_foundation_v1`,
    {
      body: "{}",
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
    throw new TherapistMetricsError("session_expired");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw mapRpcError(response.status, payload);
  }

  return (await response.json()) as unknown;
}

export async function queryTherapistMetricsOverview(
  accessToken: string,
  periodDays: 30 | 90,
) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistMetricsError("unavailable");

  const response = await fetch(
    `${config.url}/rest/v1/rpc/get_therapist_metrics_overview_v1`,
    {
      body: JSON.stringify({ p_period_days: periodDays }),
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
    throw new TherapistMetricsError("session_expired");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw mapRpcError(response.status, payload);
  }

  return (await response.json()) as unknown;
}

export async function queryTherapistMetricsDashboard(
  accessToken: string,
  periodDays: 30 | 90,
) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistMetricsError("unavailable");

  const response = await fetch(
    `${config.url}/rest/v1/rpc/get_therapist_metrics_dashboard_v2`,
    {
      body: JSON.stringify({ p_period_days: periodDays }),
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (response.status === 401)
    throw new TherapistMetricsError("session_expired");
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw mapRpcError(response.status, payload);
  }

  return (await response.json()) as unknown;
}

export function queryTherapistSessionMetrics(
  accessToken: string,
  periodDays: 30 | 90,
) {
  return queryTherapistMetricsDetail(
    accessToken,
    "get_therapist_session_metrics_v1",
    periodDays,
  );
}

export function queryTherapistInterestMetrics(
  accessToken: string,
  periodDays: 30 | 90,
) {
  return queryTherapistMetricsDetail(
    accessToken,
    "get_therapist_interest_metrics_v1",
    periodDays,
  );
}

async function queryTherapistMetricsDetail(
  accessToken: string,
  rpc: "get_therapist_interest_metrics_v1" | "get_therapist_session_metrics_v1",
  periodDays: 30 | 90,
) {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistMetricsError("unavailable");

  const response = await fetch(`${config.url}/rest/v1/rpc/${rpc}`, {
    body: JSON.stringify({ p_period_days: periodDays }),
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 401) {
    throw new TherapistMetricsError("session_expired");
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
    message === "PROFILE_NOT_FOUND"
  ) {
    return new TherapistMetricsError("forbidden");
  }

  return new TherapistMetricsError("unavailable");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
