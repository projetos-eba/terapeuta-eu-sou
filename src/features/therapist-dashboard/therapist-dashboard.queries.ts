import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { TherapistDashboardError } from "./therapist-dashboard.errors";
import type { AuraRecommendationRow } from "./therapist-dashboard.types";

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

export async function queryTherapistRecommendations(accessToken: string) {
  return requestSupabase<AuraRecommendationRow[]>(
    "/rest/v1/aura_recommendations?select=id,source_rule_key,title,body,context&is_active=eq.true&order=priority.desc,created_at.desc&limit=12",
    accessToken,
    { method: "GET" },
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
