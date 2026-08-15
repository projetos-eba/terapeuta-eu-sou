import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  readAdminSessionFromAccessToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: headerMocks.cookies,
}));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));
vi.mock("@/lib/auth/admin-session", () => ({
  readAdminSessionFromAccessToken: sessionMocks.readAdminSessionFromAccessToken,
}));

import { POST } from "./route";

describe("admin operation command route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
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
      accessToken: "admin-token",
      avatarUrl: null,
      email: "admin@example.test",
      name: "Admin TES",
      permissions: ["admin.professionals.suspend"],
      role: "admin",
      userId: "admin-user",
    });
  });

  it("executes allowlisted commands after server-side permission validation", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        entityId: "11111111-1111-4111-8111-111111111111",
        ok: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({
        action: "professional.suspend",
        entityId: "11111111-1111-4111-8111-111111111111",
        reason: "Conduta operacional revisada.",
        requestId: "request-123",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_execute_operation_command_v2",
      expect.objectContaining({
        body: expect.stringContaining("professional.suspend"),
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
          apikey: "publishable-key",
        }),
        method: "POST",
      }),
    );
  });

  it("does not execute unsupported actions", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({
        action: "professional.delete",
        entityId: "11111111-1111-4111-8111-111111111111",
        reason: "Motivo operacional.",
        requestId: "request-123",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks admins without the required capability", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      accessToken: "admin-token",
      avatarUrl: null,
      email: "admin@example.test",
      name: "Admin TES",
      permissions: ["admin.professionals.read"],
      role: "admin",
      userId: "admin-user",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({
        action: "professional.suspend",
        entityId: "11111111-1111-4111-8111-111111111111",
        reason: "Conduta operacional revisada.",
        requestId: "request-123",
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps verification commands to the verification capability", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      accessToken: "admin-token",
      avatarUrl: null,
      email: "admin@example.test",
      name: "Admin TES",
      permissions: ["admin.professionals.verify"],
      role: "admin",
      userId: "admin-user",
    });
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({
        action: "verification.approve",
        entityId: "22222222-2222-4222-8222-222222222222",
        reason: "Documentação validada pela operação.",
        requestId: "verification-request",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("verification.approve"),
      }),
    );
  });

  it("maps administrative publication to the verification capability", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      accessToken: "admin-token",
      avatarUrl: null,
      email: "admin@example.test",
      name: "Admin TES",
      permissions: ["admin.professionals.verify"],
      role: "admin",
      userId: "admin-user",
    });
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({
        action: "professional.publish",
        entityId: "22222222-2222-4222-8222-222222222222",
        reason: "Perfil revisado e pronto para publicação.",
        requestId: "publication-request",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("professional.publish"),
      }),
    );
  });

  it("allows pausing verification review through v2", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      accessToken: "admin-token",
      avatarUrl: null,
      email: "admin@example.test",
      name: "Admin TES",
      permissions: ["admin.professionals.verify"],
      role: "admin",
      userId: "admin-user",
    });
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({
        action: "verification.pause_review",
        entityId: "22222222-2222-4222-8222-222222222222",
        reason: "Análise pausada para ajuste operacional.",
        requestId: "verification-pause-request",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/rest/v1/rpc/admin_execute_operation_command_v2",
      expect.objectContaining({
        body: expect.stringContaining("verification.pause_review"),
      }),
    );
  });

  it("maps support commands to the support management capability", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      accessToken: "admin-token",
      avatarUrl: null,
      email: "admin@example.test",
      name: "Admin TES",
      permissions: ["admin.support.manage"],
      role: "admin",
      userId: "admin-user",
    });
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({
        action: "support.resolve",
        entityId: "33333333-3333-4333-8333-333333333333",
        reason: "Ticket resolvido com retorno operacional.",
        requestId: "support-request",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("support.resolve"),
      }),
    );
  });

  it("maps review moderation commands to the review moderation capability", async () => {
    sessionMocks.readAdminSessionFromAccessToken.mockResolvedValue({
      accessToken: "admin-token",
      avatarUrl: null,
      email: "admin@example.test",
      name: "Admin TES",
      permissions: ["admin.reviews.moderate"],
      role: "admin",
      userId: "admin-user",
    });
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({
        action: "review.hide",
        entityId: "44444444-4444-4444-8444-444444444444",
        reason: "Moderação revisada pela operação.",
        requestId: "review-request",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("review.hide"),
      }),
    );
  });
});

function makeJsonRequest(body: unknown) {
  return new Request("https://tes.test/api/admin/operations", {
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
