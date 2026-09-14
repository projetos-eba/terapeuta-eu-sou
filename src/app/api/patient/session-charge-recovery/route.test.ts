import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class SupabaseFunctionError extends Error {
    constructor(
      readonly functionName: string,
      readonly status: number,
    ) {
      super("function failed");
    }
  }
  return {
    cookieGet: vi.fn(),
    cookies: vi.fn(),
    getSupabasePublicConfig: vi.fn(),
    invokeSupabaseFunction: vi.fn(),
    SupabaseFunctionError,
  };
});

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase/edge-functions", () => ({
  getSupabasePublicConfig: mocks.getSupabasePublicConfig,
  invokeSupabaseFunction: mocks.invokeSupabaseFunction,
  SupabaseFunctionError: mocks.SupabaseFunctionError,
}));

import { POST } from "./route";

const bookingId = "a0000000-0000-4000-8000-000000000301";

describe("session charge recovery API", () => {
  beforeEach(() => {
    mocks.cookieGet.mockReset();
    mocks.cookies.mockReset();
    mocks.getSupabasePublicConfig.mockReset();
    mocks.invokeSupabaseFunction.mockReset();
    mocks.cookies.mockResolvedValue({ get: mocks.cookieGet });
    mocks.cookieGet.mockImplementation((name: string) =>
      name === "tes_patient_access_token"
        ? { value: "patient-access-token" }
        : undefined,
    );
    mocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "public-key",
      url: "https://tes.supabase.test",
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("forwards only the authenticated booking to the recovery function", async () => {
    mocks.invokeSupabaseFunction.mockResolvedValue({
      clientSecret: "pi_bound_secret_test",
      status: "requires_action",
    });
    const response = await POST(
      new Request("http://localhost/api/patient/session-charge-recovery", {
        body: JSON.stringify({ bookingId, paymentIntentId: "pi_injected" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.invokeSupabaseFunction).toHaveBeenCalledWith(
      expect.any(Object),
      "prepare-session-charge-recovery",
      {
        accessToken: "patient-access-token",
        body: { bookingId },
      },
    );
    expect(
      JSON.stringify(mocks.invokeSupabaseFunction.mock.calls[0]),
    ).not.toContain("pi_injected");
  });

  it("does not expose internal function errors", async () => {
    mocks.invokeSupabaseFunction.mockRejectedValue(
      new mocks.SupabaseFunctionError("prepare-session-charge-recovery", 503),
    );
    const response = await POST(
      new Request("http://localhost/api/patient/session-charge-recovery", {
        body: JSON.stringify({ bookingId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain("Não foi possível abrir");
    expect(text).not.toMatch(/Supabase|PaymentIntent|service_role/i);
  });

  it("requires the patient session cookie", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const response = await POST(
      new Request("http://localhost/api/patient/session-charge-recovery", {
        body: JSON.stringify({ bookingId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.invokeSupabaseFunction).not.toHaveBeenCalled();
  });
});
