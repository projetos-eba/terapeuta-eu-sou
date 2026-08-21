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

import { POST } from "./route";

const userId = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";

describe("support tickets route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();
    headerMocks.cookieGet.mockReturnValue({ value: "therapist-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("requires the therapist session cookie", async () => {
    headerMocks.cookieGet.mockReturnValue(undefined);
    expect((await POST(request(validTicket()))).status).toBe(401);
  });

  it("rejects claimed identity and invalid categories before calling Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(
      (await POST(request({ ...validTicket(), actorRole: "patient" }))).status,
    ).toBe(422);
    expect(
      (
        await POST(
          request({ ...validTicket(), category: "arbitrary_category" }),
        )
      ).status,
    ).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates an idempotent ticket through the server-authoritative RPC", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) return Response.json({ id: userId });
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([{ role: "therapist" }]);
        }
        if (url.includes("/rpc/create_support_ticket_v1")) {
          expect(JSON.parse(String(init?.body))).toEqual({
            p_booking_id: null,
            p_category: "financeiro_repasses",
            p_description: "Preciso entender quando o valor ficará disponível.",
            p_request_id: requestId,
            p_source: "message_center",
            p_subject: "Dúvida sobre repasse",
          });
          return Response.json({
            id: "30000000-0000-4000-8000-000000000001",
            status: "open",
          });
        }
        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validTicket()));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ticket).toEqual({
      id: "30000000-0000-4000-8000-000000000001",
      protocol: "30000000",
      status: "open",
    });
  });
});

function validTicket() {
  return {
    bookingId: null,
    category: "financeiro_repasses",
    description: "Preciso entender quando o valor ficará disponível.",
    requestId,
    source: "message_center",
    subject: "Dúvida sobre repasse",
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/support/tickets", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
