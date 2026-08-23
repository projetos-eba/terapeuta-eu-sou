import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  loginAdminWithPassword: vi.fn(),
}));
const headerMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: headerMocks.cookies }));
vi.mock("@/features/admin-auth/supabase-rest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/admin-auth/supabase-rest")>();

  return {
    ...actual,
    loginAdminWithPassword: authMocks.loginAdminWithPassword,
  };
});

import { POST } from "./route";

describe("admin login route", () => {
  beforeEach(() => {
    authMocks.loginAdminWithPassword.mockReset();
    headerMocks.cookies.mockResolvedValue({ get: vi.fn() });
    authMocks.loginAdminWithPassword.mockResolvedValue({
      accessToken: "admin-access-token",
      expiresIn: 3600,
      refreshToken: "admin-refresh-token",
      userId: "admin-user",
    });
  });

  it("redirects authenticated admins to the admin overview", async () => {
    const response = await POST(
      new Request("https://tes.test/api/auth/admin/login", {
        body: JSON.stringify({
          email: "admin@example.test",
          password: "admin-password",
        }),
        method: "POST",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      redirectTo: "/admin",
    });
    expect(response.headers.getSetCookie().join("\n")).toContain(
      "tes_admin_access_token=",
    );
  });
});
