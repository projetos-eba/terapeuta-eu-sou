import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { TherapistDashboardError } from "./therapist-dashboard.errors";

export async function queryTherapistDashboard(accessToken: string) {
  return requestSupabase<unknown>(
    "/rest/v1/rpc/get_therapist_dashboard_v1",
    accessToken,
    {
      body: {},
      method: "POST",
    },
  );
}

async function requestSupabase<T>(
  path: string,
  accessToken: string,
  options: { body?: unknown; method: "GET" | "POST" },
): Promise<T> {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistDashboardError("unavailable");

  const response = await fetch(`${config.url}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: options.method,
  });

  if (response.status === 401) {
    throw new TherapistDashboardError("session_expired");
  }

  if (response.status === 403 || response.status === 404) {
    throw new TherapistDashboardError("forbidden");
  }

  if (!response.ok) throw new TherapistDashboardError("unavailable");
  return (await response.json()) as T;
}
