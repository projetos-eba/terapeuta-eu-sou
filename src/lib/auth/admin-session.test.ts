import { beforeEach, describe, expect, it, vi } from "vitest";

import { routes } from "@/lib/routes";

const mocks = vi.hoisted(() => ({
  accessToken: "admin-token" as string | undefined,
  notFound: vi.fn(() => {
    const error = new Error("not-found") as Error & { digest: string };
    error.digest = "NEXT_HTTP_ERROR_FALLBACK;404";
    throw error;
  }),
  redirect: vi.fn((href: string) => {
    const error = new Error(href) as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;${href}`;
    throw error;
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => (mocks.accessToken ? { value: mocks.accessToken } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "publishable-key",
    url: "http://supabase.test",
  }),
}));

import {
  hasRequiredAdminPermissions,
  requireAdminSession,
} from "./admin-session";

describe("requireAdminSession", () => {
  beforeEach(() => {
    mocks.accessToken = "admin-token";
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
    mockAdminSupabaseSession();
  });

  it("returns the authenticated admin with explicit capabilities", async () => {
    await expect(
      requireAdminSession({ permission: "admin.therapies.manage" }),
    ).resolves.toMatchObject({
      name: "Admin TES",
      permissions: expect.arrayContaining([
        "admin.therapies.manage",
        "admin.audit.read",
      ]),
      role: "admin",
      userId: "admin-1",
    });
  });

  it("accepts all required capabilities for composed admin surfaces", () => {
    expect(
      hasRequiredAdminPermissions(
        ["admin.security.read", "admin.audit.read"],
        ["admin.security.read", "admin.audit.read"],
      ),
    ).toBe(true);
  });

  it("rejects composed admin surfaces when any capability is missing", () => {
    expect(
      hasRequiredAdminPermissions(
        ["admin.security.read"],
        ["admin.security.read", "admin.audit.read"],
      ),
    ).toBe(false);
  });

  it("redirects when the access token is absent", async () => {
    mocks.accessToken = undefined;

    await expect(requireAdminSession()).rejects.toThrow(routes.admin.signIn);
  });

  it("rejects authenticated non-admin profiles", async () => {
    mockAdminSupabaseSession({ role: "therapist" });

    await expect(requireAdminSession()).rejects.toThrow(routes.admin.signIn);
  });

});

function mockAdminSupabaseSession({
  role = "admin",
}: {
  role?: "admin" | "patient" | "therapist";
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "admin-1" }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            avatar_url: null,
            display_name: "Admin TES",
            email: "admin@example.test",
            id: "admin-1",
            role,
          },
        ]),
      ),
  );
}

function jsonResponse(value: unknown) {
  return {
    json: async () => value,
    ok: true,
  } as Response;
}
