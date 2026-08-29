import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: () => ({
    apiKey: "publishable-test-key",
    url: "https://example.supabase.co",
  }),
}));

import { getPatientScheduleIntervals } from "./patient-schedule";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("patient schedule query", () => {
  it("returns only confirmed bookings with a canonical paid session payment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              ends_at: "2026-08-29T22:20:00.000Z",
              id: "d1000000-0000-4000-8000-000000000001",
              starts_at: "2026-08-29T21:30:00.000Z",
            },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { booking_id: "d1000000-0000-4000-8000-000000000001" },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getPatientScheduleIntervals({
        accessToken: "patient-token",
        end: new Date("2026-08-30T00:00:00.000Z"),
        start: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      intervals: [
        {
          endsAt: "2026-08-29T22:20:00.000Z",
          startsAt: "2026-08-29T21:30:00.000Z",
        },
      ],
      status: "success",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "status=in.%28confirmed%2Ccompleted%29",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain("financial_status=eq.paid");
  });

  it("does not hide a time because a booking has not been paid", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                ends_at: "2026-08-29T04:50:00.000Z",
                id: "d1000000-0000-4000-8000-000000000001",
                starts_at: "2026-08-29T04:30:00.000Z",
              },
            ]),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response("[]", { status: 200 })),
    );

    await expect(
      getPatientScheduleIntervals({
        accessToken: "patient-token",
        end: new Date("2026-08-30T00:00:00.000Z"),
        start: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ intervals: [], status: "success" });
  });

  it("does not query or use active holds as patient encounter conflicts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getPatientScheduleIntervals({
        accessToken: "patient-token",
        end: new Date("2026-08-30T00:00:00.000Z"),
        start: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ intervals: [], status: "success" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/rest/v1/bookings?");
  });

  it("fails closed when the canonical payment read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                ends_at: "2026-08-29T22:20:00.000Z",
                id: "d1000000-0000-4000-8000-000000000001",
                starts_at: "2026-08-29T21:30:00.000Z",
              },
            ]),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response("denied", { status: 500 })),
    );

    await expect(
      getPatientScheduleIntervals({
        accessToken: "patient-token",
        end: new Date("2026-08-30T00:00:00.000Z"),
        start: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ intervals: null, status: "error" });
  });

  it("fails closed when a confirmed booking range is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                ends_at: "invalid-date",
                id: "d1000000-0000-4000-8000-000000000001",
                starts_at: "2026-08-29T21:30:00.000Z",
              },
            ]),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              { booking_id: "d1000000-0000-4000-8000-000000000001" },
            ]),
            { status: 200 },
          ),
        ),
    );

    await expect(
      getPatientScheduleIntervals({
        accessToken: "patient-token",
        end: new Date("2026-08-30T00:00:00.000Z"),
        start: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ intervals: null, status: "error" });
  });
});
