import { afterEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(() => ({
    apiKey: "public-test-key",
    url: "https://example.supabase.co",
  })),
}));

vi.mock("@/lib/supabase/public-config", () => configMocks);

import {
  queryTherapistMetricsDashboard,
  queryTherapistMetricsOverview,
  queryTherapistMetricsTodayActivity,
} from "./therapist-metrics.queries";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("queryTherapistMetricsTodayActivity", () => {
  it("requests the private projection without browser or framework cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ contractVersion: 1 }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await queryTherapistMetricsTodayActivity("access-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/get_therapist_metrics_today_v1",
      expect.objectContaining({
        body: "{}",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
        method: "POST",
      }),
    );
  });

  it("keeps an expired session distinct from unavailable data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(
      queryTherapistMetricsTodayActivity("expired-token"),
    ).rejects.toMatchObject({
      code: "session_expired",
    });
  });
});

describe("discovery metrics contracts", () => {
  it("uses the additive V2 overview and V4 dashboard contracts for complete 60-day periods", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ contractVersion: 2 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await queryTherapistMetricsOverview("access-token", 60);
    await queryTherapistMetricsDashboard("access-token", 60);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co/rest/v1/rpc/get_therapist_metrics_overview_v2",
      expect.objectContaining({
        body: JSON.stringify({ p_period_days: 60 }),
        cache: "no-store",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co/rest/v1/rpc/get_therapist_metrics_dashboard_v4",
      expect.objectContaining({
        body: JSON.stringify({ p_period_days: 60 }),
        cache: "no-store",
      }),
    );
  });
});
