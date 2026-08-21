import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: headerMocks.cookies,
}));

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { POST } from "./route";

const conversationId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";

describe("structured participant message route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();

    headerMocks.cookieGet.mockReturnValue({ value: "patient-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("calls the RPC with a template reference only", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) return Response.json({ id: userId });
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "patient" }]);
      }
      if (url.includes("send_structured_participant_message_v1")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          p_conversation_id: conversationId,
          p_template_key: "patient_confirm_session",
        });
        return Response.json({ id: "message-id" });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        actorRole: "patient",
        conversationId,
        templateKey: "patient_confirm_session",
      }),
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects arbitrary browser content before calling Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        actorRole: "patient",
        body: "Mensagem livre proibida",
        conversationId,
        templateKey: "patient_confirm_session",
      }),
    );

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a session whose real role differs from the requested direction", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) return Response.json({ id: userId });
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "therapist" }]);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        actorRole: "patient",
        conversationId,
        templateKey: "patient_confirm_session",
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps a direction-invalid template to a controlled validation error", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) return Response.json({ id: userId });
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "patient" }]);
      }
      if (url.includes("send_structured_participant_message_v1")) {
        return Response.json({ code: "22023" }, { status: 400 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        actorRole: "patient",
        conversationId,
        templateKey: "therapist_confirm_session",
      }),
    );

    expect(response.status).toBe(422);
  });
});

function request(body: unknown) {
  return new Request("http://localhost/api/messages/send-template", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
