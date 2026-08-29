import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
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

import { POST } from "./route";
import { revalidatePath, revalidateTag } from "next/cache";

describe("admin therapies route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();
    vi.mocked(revalidatePath).mockReset();
    vi.mocked(revalidateTag).mockReset();

    headerMocks.cookieGet.mockReturnValue({ value: "admin-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("forwards admin commands only after server-side capability validation", async () => {
    const fetchMock = makeFetchMock({ profileRole: "admin" });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeJsonRequest({ action: "matchingList" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ data: { ok: true }, ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/functions/v1/admin-therapy-catalog-command",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    );
  });

  it("does not forward commands from authenticated non-admin profiles", async () => {
    const fetchMock = makeFetchMock({ profileRole: "therapist" });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeJsonRequest({ action: "matchingList" }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.message).toBe("Acesso administrativo necessário.");
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/functions/v1/admin-therapy-catalog-command"),
      ),
    ).toBe(false);
  });

  it("invalidates the public home after a therapy mutation", async () => {
    const fetchMock = makeFetchMock({ profileRole: "admin" });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeJsonRequest({ action: "transition", therapyId: "therapy-1" }),
    );

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("public-home");
    expect(revalidateTag).toHaveBeenCalledWith("therapies");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });
});

function makeJsonRequest(body: unknown) {
  return new Request("https://tes.test/api/admin/therapies", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

function makeFetchMock({
  profileRole,
}: {
  profileRole: "admin" | "patient" | "therapist";
}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/auth/v1/user")) {
      return jsonResponse({ id: "admin-1" });
    }

    if (url.includes("/rest/v1/profiles")) {
      return jsonResponse([
        {
          avatar_url: null,
          display_name: "Admin TES",
          email: "admin@example.test",
          id: "admin-1",
          role: profileRole,
        },
      ]);
    }

    if (url.includes("/functions/v1/admin-therapy-catalog-command")) {
      return jsonResponse({ data: { ok: true }, ok: true });
    }

    return new Response(null, { status: 404 });
  });
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}
