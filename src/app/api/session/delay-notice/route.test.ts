import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: mocks.getConfig,
}));

import { POST } from "./route";

const bookingId = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.unstubAllGlobals();
  mocks.cookieGet.mockReset();
  mocks.cookies.mockReset();
  mocks.getConfig.mockReset();
  mocks.cookies.mockResolvedValue({ get: mocks.cookieGet });
  mocks.cookieGet.mockReturnValue({ value: "actor-token" });
  mocks.getConfig.mockReturnValue({
    apiKey: "publishable-key",
    url: "https://tes.supabase.test",
  });
});

describe("delay notice command", () => {
  it("rejects invalid data without contacting the database", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ actorRole: "patient", bookingId }));
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the actor token and the authenticated RPC", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        bookingId,
        bookingVersion: 2,
        noticeId: "event-id",
        sentAt: "2026-09-15T19:30:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      request({ actorRole: "patient", bookingId, bookingVersion: 2 }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/send_session_delay_notice_v1",
      expect.objectContaining({
        body: JSON.stringify({
          p_booking_id: bookingId,
          p_expected_booking_version: 2,
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer actor-token",
        }),
      }),
    );
    expect(mocks.cookieGet).toHaveBeenCalledWith("tes_patient_access_token");
  });
});

function request(body: unknown) {
  return new Request("http://localhost/api/session/delay-notice", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
