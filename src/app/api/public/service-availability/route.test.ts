import { afterEach, describe, expect, it, vi } from "vitest";

const availability = vi.hoisted(() => ({
  getPublicServiceAvailabilityForDay: vi.fn(),
  getPublicServiceAvailabilityMonth: vi.fn(),
  isDateKey: vi.fn((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
  isMonthKey: vi.fn((value: string) => /^\d{4}-\d{2}$/.test(value)),
}));

vi.mock(
  "@/features/availability/queries/public-service-availability",
  () => availability,
);

import { GET } from "./route";

const serviceId = "e2e10000-0000-4000-8000-000000000001";

describe("public service availability route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects ambiguous or invalid public input", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/public/service-availability?service=${serviceId}&month=2026-10&date=2026-10-14`,
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { message: "Disponibilidade indisponível no momento." },
      ok: false,
    });
    expect(
      availability.getPublicServiceAvailabilityMonth,
    ).not.toHaveBeenCalled();
  });

  it("returns the safe month contract without caching it", async () => {
    availability.getPublicServiceAvailabilityMonth.mockResolvedValue({
      data: {
        dates: ["2026-10-14"],
        horizonEndsAt: "2026-11-25T12:00:00.000Z",
        timezone: "America/Sao_Paulo",
      },
      status: "success",
    });

    const response = await GET(
      new Request(
        `http://localhost/api/public/service-availability?service=${serviceId}&month=2026-10`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ok: true, type: "month" });
  });

  it("does not turn an availability failure into an empty day", async () => {
    availability.getPublicServiceAvailabilityForDay.mockResolvedValue({
      data: null,
      status: "error",
    });

    const response = await GET(
      new Request(
        `http://localhost/api/public/service-availability?service=${serviceId}&date=2026-10-14`,
      ),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { message: "Disponibilidade indisponível no momento." },
      ok: false,
    });
  });
});
