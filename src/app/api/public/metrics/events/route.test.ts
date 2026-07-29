import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const validBody = {
  events: [
    {
      eventId: "20000000-0000-4000-8000-000000000001",
      eventType: "profile_view",
      sourceSurface: "therapist_profile",
      therapistSlug: "ana-oliveira",
    },
  ],
  sessionId: "10000000-0000-4000-8000-000000000001",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public metric events route", () => {
  it("ignores known crawlers before calling the data authority", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validBody, "ExampleBot/1.0"));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: false,
      status: "ignored",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a validated event through the anonymous RPC boundary", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: 1, status: "accepted" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validBody));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: true,
      status: "accepted",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/record_public_therapist_metric_events_v1",
      expect.objectContaining({
        body: JSON.stringify({
          p_events: validBody.events,
          p_session_id: validBody.sessionId,
        }),
        method: "POST",
      }),
    );
  });

  it("rejects unknown fields without forwarding free text", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({
        ...validBody,
        events: [{ ...validBody.events[0], note: "private content" }],
      }),
    );

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs only a sanitized category and correlation id on failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "database detail" }), {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }),
      ),
    );
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request(validBody));
    const log = String(logSpy.mock.calls[0]?.[0]);

    expect(response.status).toBe(503);
    expect(log).toContain("public_metric_ingestion_failed");
    expect(log).not.toContain("database detail");
    expect(log).not.toContain("publishable-key");
    expect(log).not.toContain(validBody.sessionId);
  });
});

function request(body: unknown, userAgent = "Mozilla/5.0") {
  return new Request("http://localhost/api/public/metrics/events", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    method: "POST",
  });
}
