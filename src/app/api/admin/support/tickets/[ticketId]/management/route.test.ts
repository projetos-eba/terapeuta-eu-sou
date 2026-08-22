import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));
const configMocks = vi.hoisted(() => ({ getSupabasePublicConfig: vi.fn() }));
const sessionMocks = vi.hoisted(() => ({
  readAdminSessionFromAccessToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: headerMocks.cookies }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));
vi.mock("@/lib/auth/admin-session", () => ({
  readAdminSessionFromAccessToken: sessionMocks.readAdminSessionFromAccessToken,
}));

import { POST } from "./route";

const ticketId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const params = { params: Promise.resolve({ ticketId }) };

describe("admin support management route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReturnValue({ value: "admin-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      permissions: ["admin.support.manage"],
    });
  });

  it("forwards only an allowlisted management action after server-side admin validation", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        ticket: { priority: "high", status: "waiting_support" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      jsonRequest({ action: "set_priority", priority: "high", requestId }),
      params,
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_manage_support_ticket_v1",
      expect.objectContaining({
        body: expect.stringContaining("set_priority"),
        method: "POST",
      }),
    );
  });

  it("rejects requester-supplied assignment and unsupported priority without forwarding", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      jsonRequest({
        action: "assign_other",
        requestId,
        requesterProfileId: "other",
      }),
      params,
    );
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks an authenticated user without support management permission", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      permissions: ["admin.support.read"],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      jsonRequest({ action: "assign_self", requestId }),
      params,
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonRequest(body: unknown) {
  return new Request("https://tes.test/api/admin/support", {
    body: JSON.stringify(body),
    method: "POST",
  });
}
function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
