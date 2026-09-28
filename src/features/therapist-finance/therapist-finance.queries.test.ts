import { afterEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(() => ({
    apiKey: "public-test-key",
    url: "https://example.supabase.co",
  })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/public-config", () => configMocks);

import { queryTherapistReceipts } from "./therapist-finance.queries";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("queryTherapistReceipts", () => {
  it("loads the additive V6 receipt contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ contractVersion: 6 }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await queryTherapistReceipts("access-token", {
      p_period_end: "2026-09-27",
      p_period_start: "2026-08-29",
      p_timezone: "America/Sao_Paulo",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/get_private_therapist_receipts_v6",
      expect.objectContaining({
        body: JSON.stringify({
          p_period_end: "2026-09-27",
          p_period_start: "2026-08-29",
          p_timezone: "America/Sao_Paulo",
        }),
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
        method: "POST",
      }),
    );
  });
});
