import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  token: "test_patient_token" as string | undefined,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (auth.token ? { value: auth.token } : undefined),
  }),
}));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    url: "http://supabase.test",
    apiKey: "test_public_key",
  }),
}));
import { GET } from "./route";
const bookingId = "d1000000-0000-4000-8000-000000000001";
const request = () =>
  new Request(
    `http://localhost/api/public/reservation/checkout/status?booking=${bookingId}&session_id=cs_test_status`,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  auth.token = "test_patient_token";
});

describe("reservation payment status", () => {
  it("reports missing authentication rather than a financial result", async () => {
    auth.token = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await GET(request())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not turn an absent or foreign booking into a failed payment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "failed" }),
      }),
    );
    const result = await GET(request());
    expect(result.status).toBe(404);
    expect(await result.json()).toEqual({ status: "unavailable" });
  });
  it("preserves the authoritative result for the authenticated booking", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "confirmed",
          bookingId,
          conflictKind: null,
        }),
      }),
    );
    const result = await GET(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      status: "confirmed",
      bookingId,
    });
  });
});
