import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "publishable-test-key",
    url: "https://example.supabase.co",
  }),
}));

import {
  getPublicServiceAvailability,
  mapAvailableSlots,
} from "./public-service-availability";

describe("public service availability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps authoritative UTC slots using the schedule timezone", () => {
    const days = mapAvailableSlots(
      [
        {
          endsAt: "2026-08-11T14:50:00.000Z",
          startsAt: "2026-08-11T14:00:00.000Z",
        },
      ],
      "e2e10000-0000-4000-8000-000000000001",
      "America/Sao_Paulo",
      new Date("2026-08-11T13:30:00.000Z"),
    );

    expect(days[0]).toEqual(
      expect.objectContaining({
        date: "2026-08-11",
        dayLabel: "Hoje",
      }),
    );
    expect(days[0]?.slots[0]).toEqual(
      expect.objectContaining({ timeLabel: "11:00" }),
    );
  });

  it("requests the public RPC without cache", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ slots: [], timezone: "America/Sao_Paulo" }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPublicServiceAvailability(
      "e2e10000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({ data: [], status: "success" });
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
  });
});
