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
vi.mock("@/lib/auth/admin-session", () => ({
  readAdminSessionFromAccessToken: sessionMocks.readAdminSessionFromAccessToken,
}));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { revalidatePath } from "next/cache";

import { POST } from "./route";

const requestId = "22222222-2222-4222-8222-222222222222";

describe("admin metrics telemetry route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(revalidatePath).mockReset();
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();
    sessionMocks.readAdminSessionFromAccessToken.mockReset();
    headerMocks.cookieGet.mockReturnValue({ value: "admin-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      permissions: ["admin.settings.manage"],
      role: "admin",
    });
  });

  it("forwards only the validated change to the server command and revalidates admin views", async () => {
    const fetchMock = vi.fn(async () => response({
      data: { enabled: true, retentionDays: 120 },
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await POST(makeRequest());

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/functions/v1/admin-therapist-metrics-command",
      expect.objectContaining({
        body: JSON.stringify({
          enabled: true,
          reason: "Ativação aprovada para homologação controlada.",
          requestId,
        }),
        headers: expect.objectContaining({ Authorization: "Bearer admin-token" }),
        method: "POST",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/seguranca");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/configuracoes");
  });

  it("does not invoke the server command without settings management permission", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      permissions: ["admin.settings.read"],
      role: "admin",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await POST(makeRequest());

    expect(result.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an incomplete justification before reading the session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await POST(makeRequest({ reason: "curta" }));

    expect(result.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionMocks.readAdminSessionFromAccessToken).not.toHaveBeenCalled();
  });
});

function makeRequest(overrides: Record<string, unknown> = {}) {
  return new Request("https://tes.local/api/admin/metricas/telemetria", {
    body: JSON.stringify({
      enabled: true,
      reason: "Ativação aprovada para homologação controlada.",
      requestId,
      ...overrides,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function response(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
