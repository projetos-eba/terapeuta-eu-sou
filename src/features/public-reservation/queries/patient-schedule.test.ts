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
  it("returns the canonical patient-blocking intervals from the authenticated RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            ends_at: "2026-08-29T22:20:00.000Z",
            starts_at: "2026-08-29T21:30:00.000Z",
          },
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://example.supabase.co/rest/v1/rpc/get_my_patient_schedule_blocking_intervals_v1",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        p_range_end: "2026-08-30T00:00:00.000Z",
        p_range_start: "2026-08-29T00:00:00.000Z",
      }),
      headers: expect.objectContaining({
        Authorization: "Bearer patient-token",
      }),
      method: "POST",
    });
  });

  it("returns an empty schedule when the canonical RPC has no blockers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("[]", { status: 200 })),
    );

    await expect(
      getPatientScheduleIntervals({
        accessToken: "patient-token",
        end: new Date("2026-08-30T00:00:00.000Z"),
        start: new Date("2026-08-29T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ intervals: [], status: "success" });
  });

  it("reports unavailable when the canonical RPC fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("denied", { status: 500 })),
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
      vi.fn().mockResolvedValueOnce(
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
