import { afterEach, describe, expect, it, vi } from "vitest";

import { emitPublicMetricEvents } from "./public-metric-events.client";

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("emitPublicMetricEvents", () => {
  it("keeps the telemetry request on the first-party origin", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("10000000-0000-4000-8000-000000000001")
        .mockReturnValueOnce("20000000-0000-4000-8000-000000000001"),
    });

    emitPublicMetricEvents([
      {
        eventType: "profile_view",
        sourceSurface: "therapist_profile",
        therapistSlug: "ana-oliveira",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/metrics/events",
      expect.objectContaining({
        credentials: "same-origin",
        method: "POST",
      }),
    );
  });
});
