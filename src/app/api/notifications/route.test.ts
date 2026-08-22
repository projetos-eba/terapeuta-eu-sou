import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: headerMocks.cookies }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { GET } from "./route";

describe("notifications route", () => {
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

  it("returns only authenticated notification fields and the unread count", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) return Response.json({ id: "user-1" });
      if (url.includes("kind=eq.booking_confirmed")) return Response.json([]);
      if (url.includes("read_at=is.null")) {
        return new Response("[]", {
          headers: { "content-range": "0-0/3" },
        });
      }
      return Response.json([
        {
          body: "Atualização segura.",
          created_at: "2026-08-21T12:00:00.000Z",
          href: "/terapeutas/brunna-p",
          id: "10000000-0000-4000-8000-000000000001",
          kind: "support_ticket_updated",
          read_at: null,
          title: "Atualização do seu chamado",
        },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      count: 3,
      items: [
        {
          body: "Atualização segura.",
          createdAt: "2026-08-21T12:00:00.000Z",
          href: null,
          id: "10000000-0000-4000-8000-000000000001",
          kind: "support_ticket_updated",
          readAt: null,
          title: "Atualização do seu chamado",
        },
      ],
      toast: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("profile_id=eq.user-1"),
      expect.objectContaining({
        headers: expect.objectContaining({ Range: "0-0" }),
      }),
    );
  });

  it("requires an authenticated session cookie", async () => {
    headerMocks.cookieGet.mockReturnValue(undefined);

    const response = await GET();

    expect(response.status).toBe(401);
  });
});
