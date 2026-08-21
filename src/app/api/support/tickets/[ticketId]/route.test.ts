import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));
const configMocks = vi.hoisted(() => ({ getSupabasePublicConfig: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: headerMocks.cookies }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { GET, POST } from "./route";

const ticketId = "30000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ ticketId }) };

describe("support ticket detail route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReturnValue({ value: "therapist-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("serializes only requester-visible messages from the authenticated therapist ticket", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
      }
      if (url.includes("/rest/v1/profiles")) {
        return Response.json([{ role: "therapist" }]);
      }
      if (url.includes("/rest/v1/support_tickets")) {
        return Response.json([
          {
            booking_id: null,
            category: "financeiro_repasses",
            created_at: "2026-08-21T12:00:00Z",
            description: "Mensagem inicial.",
            id: ticketId,
            last_activity_at: "2026-08-21T12:00:00Z",
            resolved_at: null,
            status: "open",
            subject: "Dúvida sobre repasse",
          },
        ]);
      }
      if (url.includes("/rest/v1/support_ticket_messages")) {
        expect(url).toContain("visibility=eq.requester");
        return Response.json([
          {
            author_role: "admin",
            body: "A equipe TES está acompanhando.",
            created_at: "2026-08-21T12:05:00Z",
            id: "40000000-0000-4000-8000-000000000001",
          },
        ]);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost"), context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ticket.messages).toEqual([
      expect.objectContaining({ body: "A equipe TES está acompanhando." }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("internal");
  });

  it("rejects an empty requester reply before calling Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ body: "   ", requestId }), context);

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a public reply through the requester RPC without browser identity", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) {
          return Response.json({ id: "10000000-0000-4000-8000-000000000001" });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([{ role: "therapist" }]);
        }
        if (url.includes("/rpc/send_support_ticket_requester_message_v1")) {
          expect(JSON.parse(String(init?.body))).toEqual({
            p_body: "Complemento público.",
            p_request_id: requestId,
            p_ticket_id: ticketId,
          });
          return Response.json({ id: "40000000-0000-4000-8000-000000000002" });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ body: "Complemento público.", requestId }),
      context,
    );

    expect(response.status).toBe(201);
  });
});

function request(body: unknown) {
  return new Request("http://localhost", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
