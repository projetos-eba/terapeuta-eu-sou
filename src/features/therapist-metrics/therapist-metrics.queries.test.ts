import { afterEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(() => ({
    apiKey: "public-test-key",
    url: "https://example.supabase.co",
  })),
}));

vi.mock("@/lib/supabase/public-config", () => configMocks);

import { queryTherapistMetricsTodayActivity } from "./therapist-metrics.queries";

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
