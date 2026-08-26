import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const bookingId = "94000000-0000-4000-8000-000000000021";

describe("zoom video session access route", () => {
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects unauthenticated patients before calling the Edge Function", async () => {
    headerMocks.cookieGet.mockReturnValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ actorRole: "patient" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.message).toBe("Entre na sua conta para continuar.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before reading cookies", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest(
        { actorRole: "patient" },
        {
          host: "localhost:3000",
          origin: "https://evil.example.test",
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(headerMocks.cookies).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates booking id, intent and actor role without forwarding", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const invalidBooking = await POST(makeRequest({ bookingId: "bad-id" }));
    const invalidIntent = await POST(makeRequest({ intent: "download-token" }));
    const invalidRole = await POST(makeRequest({ actorRole: "admin" }));

    expect(invalidBooking.status).toBe(422);
    expect(invalidIntent.status).toBe(422);
    expect(invalidRole.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards patient access with only the patient cookie token", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) =>
      name === "tes_patient_access_token"
        ? { value: "patient-access-token" }
        : undefined,
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            access: {
              allowed: false,
              reason: "too_early",
              videoSessionStatus: "ready",
            },
          },
          ok: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({ actorRole: "patient", intent: "preview" }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/functions/v1/zoom-video-session-access",
      expect.objectContaining({
        body: JSON.stringify({
          actorRole: "patient",
          bookingId,
          intent: "preview",
        }),
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer patient-access-token",
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls[0]?.[1])).not.toMatch(
      /service_role|secret/i,
    );
  });

  it("uses the therapist cookie only when actorRole is therapist", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) => {
      if (name === "tes_patient_access_token") {
        return { value: "patient-access-token" };
      }
      if (name === "tes_therapist_access_token") {
        return { value: "therapist-access-token" };
      }
      return undefined;
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), {
        headers: { "Content-Type": "application/json" },
        status: 403,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({ actorRole: "therapist", intent: "join" }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer therapist-access-token",
        }),
      }),
    );
  });

  it("forwards final-end intent only with the therapist session", async () => {
    headerMocks.cookieGet.mockImplementation((name: string) =>
      name === "tes_therapist_access_token"
        ? { value: "therapist-access-token" }
        : undefined,
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ended: true }, ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({ actorRole: "therapist", intent: "end" }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tes.supabase.test/functions/v1/zoom-video-session-access",
      expect.objectContaining({
        body: JSON.stringify({
          actorRole: "therapist",
          bookingId,
          intent: "end",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer therapist-access-token",
        }),
      }),
    );
  });

  it("fails safely when the upstream access request does not finish", async () => {
    vi.useFakeTimers();
    headerMocks.cookieGet.mockImplementation((name: string) =>
      name === "tes_patient_access_token"
        ? { value: "patient-access-token" }
        : undefined,
    );
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = POST(
      makeRequest({ actorRole: "patient", intent: "preview" }),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await responsePromise;
    const payload = await response.json();

    expect(response.status).toBe(504);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.message).toMatch(/demorou mais que o esperado/i);
  });
});

function makeRequest(
  overrides: Partial<{
    actorRole: string | null;
    bookingId: string;
    intent: string | null;
  }> = {},
  headers: { host?: string; origin?: string } = {},
) {
  const requestHeaders = new Headers({
    "Content-Type": "application/json",
    host: headers.host ?? "localhost:3000",
  });
  if (headers.origin) {
    requestHeaders.set("origin", headers.origin);
  }

  return new Request("http://localhost:3000/api/zoom/video-session-access", {
    body: JSON.stringify({
      actorRole: "patient",
      bookingId,
      intent: "join",
      ...overrides,
    }),
    headers: requestHeaders,
    method: "POST",
  });
}
