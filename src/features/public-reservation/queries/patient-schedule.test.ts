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
  it("reads only active ranges with the patient bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              ends_at: "2026-08-29T22:20:00.000Z",
              starts_at: "2026-08-29T21:30:00.000Z",
            },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getPatientScheduleIntervals({
        accessToken: "patient-token",
        end: new Date("2026-08-30T00:00:00.000Z"),
        now: new Date("2026-08-28T20:00:00.000Z"),
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
    expect(fetchMock.mock.calls).toHaveLength(2);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer patient-token",
        }),
      }),
    );
  });

  it("fails closed when either personalized read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
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

  it("does not treat the current provisional booking as another patient encounter", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                ends_at: "2026-08-29T04:50:00.000Z",
                service_id: "d1000000-0000-4000-8000-000000000001",
                starts_at: "2026-08-29T04:30:00.000Z",
              },
              {
                ends_at: "2026-08-29T06:20:00.000Z",
                service_id: "d1000000-0000-4000-8000-000000000002",
                starts_at: "2026-08-29T05:30:00.000Z",
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
        currentReservation: {
          serviceId: "d1000000-0000-4000-8000-000000000001",
          startsAt: "2026-08-29T04:30:00.000Z",
        },
        end: new Date("2026-08-30T00:00:00.000Z"),
        start: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      intervals: [
        {
          endsAt: "2026-08-29T06:20:00.000Z",
          startsAt: "2026-08-29T05:30:00.000Z",
        },
      ],
      status: "success",
    });
  });

  it("continues to report an active hold that overlaps the current reservation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                ends_at: "2026-08-29T04:50:00.000Z",
                service_id: "d1000000-0000-4000-8000-000000000001",
                starts_at: "2026-08-29T04:30:00.000Z",
              },
            ]),
            { status: 200 },
          ),
        ),
    );

    await expect(
      getPatientScheduleIntervals({
        accessToken: "patient-token",
        currentReservation: {
          serviceId: "d1000000-0000-4000-8000-000000000001",
          startsAt: "2026-08-29T04:30:00.000Z",
        },
        end: new Date("2026-08-30T00:00:00.000Z"),
        start: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      intervals: [
        {
          endsAt: "2026-08-29T04:50:00.000Z",
          startsAt: "2026-08-29T04:30:00.000Z",
        },
      ],
      status: "success",
    });
  });

  it("fails closed when a personalized range is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                ends_at: "invalid-date",
                starts_at: "2026-08-29T21:30:00.000Z",
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
    ).resolves.toEqual({ intervals: null, status: "error" });
  });
});
