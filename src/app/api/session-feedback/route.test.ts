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
const requestId = "96000000-0000-4000-8000-000000000099";

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
      new Request(`http://localhost:3000/api/session-feedback?bookingId=${bookingId}&actorRole=patient`),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/get_session_quality_feedback_v1",
      expect.objectContaining({
        body: JSON.stringify({ p_booking_id: bookingId }),
        headers: expect.objectContaining({
          Authorization: "Bearer patient-access-token",
        }),
        method: "POST",
      }),
    );
  });

  it("uses the requested session cookie without forwarding the role as identity", async () => {
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
          actorRole: "patient",
          bookingId,
          contractVersion: 2,
          sessionAttemptId: bookingId,
          successful: true,
          qualityReason: null,
          comment: "Tudo bem.",
          rating: 5,
          requestId,
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
          contractVersion: 2,
          sessionAttemptId: bookingId,
          successful: true,
          qualityReason: null,
          comment: "Tudo bem.",
          rating: 5,
          requestId,
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer patient-access-token",
        }),
        method: "POST",
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toMatch(/actorRole|service_role/i);
  });

  it("does not read the therapist's private answer using a patient page with both cookies", async () => {
    mocks.cookieGet.mockImplementation((name: string) =>
      name === "tes_patient_access_token" ? { value: "patient-access-token" }
        : name === "tes_therapist_access_token" ? { value: "therapist-access-token" } : undefined,
    );
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "eligible" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(new Request(`http://localhost:3000/api/session-feedback?bookingId=${bookingId}&actorRole=patient`));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer patient-access-token");

    await GET(new Request(`http://localhost:3000/api/session-feedback?bookingId=${bookingId}&actorRole=therapist`));
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer therapist-access-token");
  });

  it("rejects a missing or incompatible actor role before reading any cookie", async () => {
    const response = await GET(new Request(`http://localhost:3000/api/session-feedback?bookingId=${bookingId}`));
    expect(response.status).toBe(422);
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
});
