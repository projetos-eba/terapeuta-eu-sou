import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "publishable-test-key",
    url: "https://example.supabase.co",
  }),
}));

import {
  getPublicServiceAvailabilityForDay,
  getPublicServiceAvailabilityForWindow,
  getPublicServiceAvailabilityMonth,
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
          JSON.stringify({
            horizonEndsAt: "2026-11-09T12:00:00.000Z",
            slots: [],
            timezone: "America/Sao_Paulo",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPublicServiceAvailability(
      "e2e10000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({
      data: {
        days: [],
        horizonEndsAt: "2026-11-09T12:00:00.000Z",
        timezone: "America/Sao_Paulo",
      },
      status: "success",
    });
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
  });

  it("reads available local dates by month without loading every slot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              days: [{ date: "2026-10-14" }, { date: "2026-10-21" }],
              horizonEndsAt: "2026-11-09T12:00:00.000Z",
              timezone: "America/Sao_Paulo",
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(
      getPublicServiceAvailabilityMonth(
        "e2e10000-0000-4000-8000-000000000001",
        "2026-10",
      ),
    ).resolves.toEqual({
      data: {
        dates: ["2026-10-14", "2026-10-21"],
        horizonEndsAt: "2026-11-09T12:00:00.000Z",
        timezone: "America/Sao_Paulo",
      },
      status: "success",
    });
  });

  it("loads one local day for a selected reservation slot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              horizonEndsAt: "2026-11-09T12:00:00.000Z",
              slots: [],
              timezone: "America/Sao_Paulo",
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(
      getPublicServiceAvailabilityForDay(
        "e2e10000-0000-4000-8000-000000000001",
        "2026-10-14",
      ),
    ).resolves.toMatchObject({ status: "success" });
  });

  it("loads all five reservation days and keeps neighboring slots", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            horizonEndsAt: "2026-11-09T12:00:00.000Z",
            slots: [
              {
                endsAt: "2026-10-16T14:20:00.000Z",
                startsAt: "2026-10-16T14:00:00.000Z",
              },
            ],
            timezone: "America/Sao_Paulo",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPublicServiceAvailabilityForWindow(
      "e2e10000-0000-4000-8000-000000000001",
      "2026-10-14",
      "America/Sao_Paulo",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      p_range_end: "2026-10-19T03:00:00.000Z",
      p_range_start: "2026-10-14T03:00:00.000Z",
    });
    expect(result).toMatchObject({
      data: {
        days: [
          {
            date: "2026-10-16",
            slots: [expect.objectContaining({ timeLabel: "11:00" })],
          },
        ],
      },
      status: "success",
    });
  });

  it("fails the five-day window as a unit instead of returning partial data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    await expect(
      getPublicServiceAvailabilityForWindow(
        "e2e10000-0000-4000-8000-000000000001",
        "2026-10-14",
        "America/Sao_Paulo",
      ),
    ).resolves.toEqual({ data: null, status: "error" });
  });

  it("uses calendar boundaries across a daylight-saving transition", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            horizonEndsAt: "2026-06-01T12:00:00.000Z",
            slots: [],
            timezone: "America/New_York",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getPublicServiceAvailabilityForWindow(
      "e2e10000-0000-4000-8000-000000000001",
      "2026-03-08",
      "America/New_York",
    );

    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      p_range_end: "2026-03-13T04:00:00.000Z",
      p_range_start: "2026-03-08T05:00:00.000Z",
    });
  });
});
