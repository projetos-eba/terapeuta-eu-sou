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

describe("structured participant preview route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mocks.cookieGet.mockReset();
    mocks.cookies.mockReset();
    mocks.getConfig.mockReset();
    mocks.cookieGet.mockReturnValue({ value: "patient-token" });
    mocks.cookies.mockResolvedValue({ get: mocks.cookieGet });
    mocks.getConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("returns server-resolved preview without a message body from the browser", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user"))
        return Response.json({ id: "20000000-0000-4000-8000-000000000001" });
      if (url.includes("/rest/v1/profiles"))
        return Response.json([{ role: "patient" }]);
      if (url.includes("preview_structured_participant_message_v2"))
        return Response.json({
          body: "Texto aprovado",
          cta: null,
          recipientName: "Terapeuta",
        });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        actorRole: "patient",
        conversationId: "10000000-0000-4000-8000-000000000001",
        templateKey: "patient_confirm_session",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        ok: true,
        preview: expect.objectContaining({ body: "Texto aprovado" }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("preview_structured_participant_message_v2"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects browser content and arbitrary fields", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      request({
        actorRole: "patient",
        body: "livre",
        conversationId: "10000000-0000-4000-8000-000000000001",
        templateKey: "patient_confirm_session",
      }),
    );
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function request(body: unknown) {
  return new Request("http://localhost/api/messages/preview-template", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
