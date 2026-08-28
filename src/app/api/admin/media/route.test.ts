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
vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { POST } from "./route";

const adminUserId = "a1000000-0000-4000-8000-000000000001";

describe("admin media route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();

    headerMocks.cookieGet.mockReturnValue({ value: "admin-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("requires an authenticated admin session", async () => {
    headerMocks.cookieGet.mockReturnValue(undefined);

    const response = await POST(
      makeRequest({
        file: makePngFile("theme.png"),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.message).toBe(
      "Entre com uma conta administrativa para continuar.",
    );
  });

  it("rejects files whose bytes do not match the declared MIME type", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: new File(["fake png"], "theme.png", { type: "image/png" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.message).toBe(
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads admin public media with an admin-scoped random object path", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: makePngFile("theme.png"),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.publicUrl).toContain(
      `/storage/v1/object/public/admin-public-media/matching/themes/${adminUserId}-`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        `/storage/v1/object/admin-public-media/matching/themes/${adminUserId}-`,
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
          apikey: "publishable-key",
          "x-upsert": "false",
        }),
        method: "POST",
      }),
    );
  });

  it("uploads therapy images to the public therapy media namespace", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        context: "therapy-image",
        file: makePngFile("therapy.png"),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.publicUrl).toContain(
      `/storage/v1/object/public/admin-public-media/therapies/${adminUserId}-`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        `/storage/v1/object/admin-public-media/therapies/${adminUserId}-`,
      ),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

function makeRequest({
  context = "matching-theme",
  file,
}: {
  context?: "matching-theme" | "therapy-image";
  file: File;
}) {
  const formData = new FormData();
  formData.set("context", context);
  formData.set("file", file);

  return {
    formData: async () => formData,
  } as Request;
}

function makeFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/auth/v1/user")) {
      return jsonResponse({ id: adminUserId });
    }

    if (url.includes("/rest/v1/profiles")) {
      return jsonResponse([{ role: "admin" }]);
    }

    if (url.includes("/storage/v1/object/admin-public-media/")) {
      return new Response(null, { status: 200 });
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

function makePngFile(name: string) {
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    name,
    { type: "image/png" },
  );
}
