import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
  getSupabasePublicConfig: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: mocks.getSupabasePublicConfig,
}));

import { GET, PUT } from "./route";

const bookingId = "96000000-0000-4000-8000-000000000001";

describe("session observations API", () => {
  beforeEach(() => {
    mocks.cookieGet.mockReset();
    mocks.cookies.mockReset();
    mocks.getSupabasePublicConfig.mockReset();
    mocks.cookies.mockResolvedValue({ get: mocks.cookieGet });
    mocks.cookieGet.mockReturnValue({ value: "therapist-access-token" });
    mocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
    vi.unstubAllGlobals();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("forwards a private read with only the therapist token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { canEdit: true, observation: null }, ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(`http://localhost:3000/api/therapist/session-observations?bookingId=${bookingId}`),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://tes.supabase.test/functions/v1/session-observations-command?bookingId=${bookingId}`,
      expect.objectContaining({
        headers: { Authorization: "Bearer therapist-access-token" },
        method: "GET",
      }),
    );
  });

  it("forwards saves as PUT without exposing a service key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { observation: {} }, ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await PUT(
      new Request("http://localhost:3000/api/therapist/session-observations", {
        body: JSON.stringify({
          bookingId,
          content: "Observação privada.",
          requestId: "96000000-0000-4000-8000-000000000099",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toMatch(/service_role/i);
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
