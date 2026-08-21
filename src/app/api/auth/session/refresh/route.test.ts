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

describe("auth session refresh route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();

    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("rotates the patient cookies when the access token is near expiry", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) => {
      if (name === "tes_patient_access_token") {
        return { value: tokenExpiringAt(Date.now() + 5 * 60_000) };
      }
      if (name === "tes_patient_refresh_token") {
        return { value: "current-refresh-token" };
      }
      return undefined;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "new-access-token",
          expires_in: 3600,
          refresh_token: "new-refresh-token",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "patient-user" }))
      .mockResolvedValueOnce(jsonResponse([{ role: "patient" }]));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ role: "patient" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, refreshed: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://tes.supabase.test/auth/v1/token?grant_type=refresh_token",
      expect.objectContaining({
        body: JSON.stringify({ refresh_token: "current-refresh-token" }),
        method: "POST",
      }),
    );
    expect(response.headers.getSetCookie().join("\n")).toContain(
      "tes_patient_access_token=new-access-token",
    );
    expect(response.headers.getSetCookie().join("\n")).toContain(
      "tes_patient_refresh_token=new-refresh-token",
    );
  });

  it("does not rotate a current token before the refresh window", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) => {
      if (name === "tes_therapist_access_token") {
        return { value: tokenExpiringAt(Date.now() + 30 * 60_000) };
      }
      if (name === "tes_therapist_refresh_token") {
        return { value: "therapist-refresh-token" };
      }
      return undefined;
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ role: "therapist" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      refreshed: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears only the requested role cookies when token rotation loses role authorization", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) => {
      if (name === "tes_admin_access_token") {
        return { value: tokenExpiringAt(Date.now() - 1) };
      }
      if (name === "tes_admin_refresh_token") {
        return { value: "admin-refresh-token" };
      }
      return undefined;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            access_token: "new-admin-access-token",
            expires_in: 3600,
            refresh_token: "new-admin-refresh-token",
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ id: "admin-user" }))
        .mockResolvedValueOnce(jsonResponse([{ role: "patient" }])),
    );

    const response = await POST(makeRequest({ role: "admin" }));
    const cookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(401);
    expect(cookies).toContain("tes_admin_access_token=");
    expect(cookies).toContain("tes_admin_refresh_token=");
    expect(cookies).not.toContain("tes_patient_access_token=");
  });

  it("preserves rotated cookies when profile validation is temporarily unavailable", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) => {
      if (name === "tes_patient_access_token") {
        return { value: tokenExpiringAt(Date.now() + 5 * 60_000) };
      }
      if (name === "tes_patient_refresh_token") {
        return { value: "patient-refresh-token" };
      }
      return undefined;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            access_token: "new-patient-access-token",
            expires_in: 3600,
            refresh_token: "new-patient-refresh-token",
          }),
        )
        .mockResolvedValueOnce(
          new Response("temporarily unavailable", { status: 503 }),
        ),
    );

    const response = await POST(makeRequest({ role: "patient" }));
    const cookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(503);
    expect(cookies).toContain(
      "tes_patient_access_token=new-patient-access-token",
    );
    expect(cookies).toContain(
      "tes_patient_refresh_token=new-patient-refresh-token",
    );
  });

  it("rejects cross-origin refresh requests before reading session cookies", async () => {
    const response = await POST(
      makeRequest(
        { role: "patient" },
        { host: "tes.test", origin: "https://other.test" },
      ),
    );

    expect(response.status).toBe(403);
    expect(headerMocks.cookies).not.toHaveBeenCalled();
  });
});

function makeRequest(
  body: { role: string },
  headers: { host?: string; origin?: string } = {},
) {
  const requestHeaders = new Headers({
    "Content-Type": "application/json",
    host: headers.host ?? "tes.test",
  });
  if (headers.origin) requestHeaders.set("origin", headers.origin);

  return new Request("https://tes.test/api/auth/session/refresh", {
    body: JSON.stringify(body),
    headers: requestHeaders,
    method: "POST",
  });
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}

function tokenExpiringAt(expiresAt: number) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(expiresAt / 1000) }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}
