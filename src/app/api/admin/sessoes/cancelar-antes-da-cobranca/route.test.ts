import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));
const configMocks = vi.hoisted(() => ({ getSupabasePublicConfig: vi.fn() }));
const sessionMocks = vi.hoisted(() => ({
  readAdminSessionFromAccessToken: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: headerMocks.cookies }));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));
vi.mock("@/lib/auth/admin-session", () => ({
  readAdminSessionFromAccessToken: sessionMocks.readAdminSessionFromAccessToken,
}));

import { revalidatePath } from "next/cache";

import { POST } from "./route";

const bookingId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

describe("admin pre-charge session cancellation route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(revalidatePath).mockReset();
    headerMocks.cookieGet.mockReturnValue({ value: "admin-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      permissions: ["admin.sessions.manage"],
      role: "admin",
    });
  });

  it("uses the dedicated local-only RPC and revalidates the session views", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      bookingId,
      canceled: true,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_cancel_uncharged_session_v10",
      expect.objectContaining({
        body: expect.stringContaining(bookingId),
        headers: expect.objectContaining({ Authorization: "Bearer admin-token" }),
        method: "POST",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/sessoes");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/sessoes/${bookingId}`);
  });

  it("does not call the command without the session-management permission", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      permissions: ["admin.sessions.read"],
      role: "admin",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates the mandatory administrative justification before the RPC", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ reason: "curta" }));

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function makeRequest(overrides: Record<string, string> = {}) {
  return new Request("https://tes.local/api/admin/sessoes/cancelar-antes-da-cobranca", {
    body: JSON.stringify({
      bookingId,
      reason: "Reserva duplicada confirmada pela equipe.",
      requestId,
      ...overrides,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
