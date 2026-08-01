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

const userId = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";

describe("support tickets route", () => {
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

  it("requires the actor session cookie", async () => {
    headerMocks.cookieGet.mockReturnValue(undefined);

    const response = await POST(
      request({
        actorRole: "patient",
        requestId,
        templateKey: "patient_support_payment",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("rejects unknown support templates before calling Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        actorRole: "patient",
        requestId,
        templateKey: "free_text_attempt",
      }),
    );

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates an idempotent support ticket with server-side template content", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/auth/v1/user")) {
          return Response.json({ id: userId });
        }

        if (url.includes("/rest/v1/support_tickets")) {
          expect(JSON.parse(String(init?.body))).toEqual(
            expect.objectContaining({
              category: "financeiro",
              description:
                "Preciso de ajuda com pagamento, reembolso ou comprovante.",
              request_id: requestId,
              requester_profile_id: userId,
              subject: "Pagamento ou reembolso",
            }),
          );

          return Response.json([
            {
              id: "30000000-0000-4000-8000-000000000001",
              status: "open",
            },
          ]);
        }

        return new Response(null, { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        actorRole: "patient",
        requestId,
        templateKey: "patient_support_payment",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ticket.protocol).toBe("30000000");
  });
});

function request(body: unknown) {
  return new Request("http://localhost/api/support/tickets", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}
