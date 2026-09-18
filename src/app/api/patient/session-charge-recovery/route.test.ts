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
      ok: true,
      data: {
        clientSecret: "pi_bound_secret_test",
        status: "requires_action",
      },
    });
    const response = await POST(
      new Request("http://localhost/api/patient/session-charge-recovery", {
        body: JSON.stringify({ bookingId, paymentIntentId: "pi_injected" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        clientSecret: "pi_bound_secret_test",
        status: "requires_action",
      },
    });
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

  it("opens replacement-card recovery using the existing payment response", async () => {
    mocks.invokeSupabaseFunction.mockResolvedValue({
      ok: true,
      data: {
        clientSecret: "pi_bound_secret_test",
        status: "requires_payment_method",
        internalMetadata: "not-for-the-browser",
      },
      requestId: "not-for-the-browser",
    });
    const response = await POST(
      new Request("http://localhost/api/patient/session-charge-recovery", {
        body: JSON.stringify({ bookingId }),
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        clientSecret: "pi_bound_secret_test",
        status: "requires_payment_method",
      },
    });
  });

  it.each([
    null,
    [],
    { clientSecret: "pi_bound_secret_test", status: "requires_action" },
    {
      ok: false,
      data: { clientSecret: "pi_bound_secret_test", status: "requires_action" },
    },
    { ok: true, data: null },
    { ok: true, data: [] },
    {
      ok: true,
      data: {
        ok: true,
        data: {
          clientSecret: "pi_bound_secret_test",
          status: "requires_action",
        },
      },
    },
    { ok: true, data: { clientSecret: "", status: "requires_action" } },
    { ok: true, data: { clientSecret: "   ", status: "requires_action" } },
    { ok: true, data: { clientSecret: 123, status: "requires_action" } },
    {
      ok: true,
      data: { clientSecret: "pi_bound_secret_test", status: "succeeded" },
    },
    {
      ok: true,
      data: { clientSecret: "pi_bound_secret_test", status: "processing" },
    },
  ])(
    "rejects malformed or unavailable recovery responses without exposing them (%#)",
    async (payload) => {
      mocks.invokeSupabaseFunction.mockResolvedValue(payload);
      const response = await POST(
        new Request("http://localhost/api/patient/session-charge-recovery", {
          body: JSON.stringify({ bookingId }),
          method: "POST",
        }),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.data).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("pi_bound_secret_test");
      expect(body.error.message).toBe(
        "Não foi possível abrir a confirmação do pagamento agora.",
      );
    },
  );

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
