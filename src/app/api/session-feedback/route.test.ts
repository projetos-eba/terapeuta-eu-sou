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

import { GET, POST } from "./route";

const bookingId = "96000000-0000-4000-8000-000000000001";

describe("session feedback API", () => {
  beforeEach(() => {
    mocks.cookieGet.mockReset();
    mocks.cookies.mockReset();
    mocks.getSupabasePublicConfig.mockReset();
    mocks.cookies.mockResolvedValue({ get: mocks.cookieGet });
    mocks.cookieGet.mockImplementation((name: string) =>
      name === "tes_patient_access_token" ? { value: "patient-access-token" } : undefined,
    );
    mocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
    vi.unstubAllGlobals();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reads only the authenticated participant feedback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ feedback: null, status: "available" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(`http://localhost:3000/api/session-feedback?bookingId=${bookingId}`),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/get_session_feedback_v1",
      expect.objectContaining({
        body: JSON.stringify({ p_booking_id: bookingId }),
        headers: expect.objectContaining({
          Authorization: "Bearer patient-access-token",
        }),
        method: "POST",
      }),
    );
  });

  it("forwards only the answer to the authenticated server command", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { feedback: { id: "feedback-1" } } }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost:3000/api/session-feedback", {
        body: JSON.stringify({
          bookingId,
          comment: "Tudo bem.",
          notPerformedReason: null,
          outcome: "completed",
          rating: 5,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/functions/v1/session-feedback-command",
      expect.objectContaining({
        body: JSON.stringify({
          bookingId,
          comment: "Tudo bem.",
          notPerformedReason: null,
          outcome: "completed",
          rating: 5,
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer patient-access-token",
        }),
        method: "POST",
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toMatch(/actorRole|requestId|service_role/i);
  });
});
