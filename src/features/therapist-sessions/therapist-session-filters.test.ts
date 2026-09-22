import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingStatus } from "@/domain/tes";
import { formatSessionDateTime } from "@/features/bookings";

import {
  buildLoadMoreSessionsHref,
  buildNextSessionsHref,
  parseTherapistSessionCursor,
  parseTherapistSessionFilters,
  parseTherapistSessionListLimits,
} from "./therapist-session-filters";

describe("therapist session filters", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the last 30 days and supports explicit period presets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));

    const defaultPeriod = parseTherapistSessionFilters({});
    expect(defaultPeriod).toMatchObject({
      filters: {
        limit: 5,
        periodPreset: "30",
        periodEnd: "2026-08-25T12:00:00.000Z",
        periodStart: "2026-07-26T12:00:00.000Z",
      },
      valid: true,
    });

    const sevenDays = parseTherapistSessionFilters({ period: "7" });
    expect(sevenDays).toMatchObject({
      filters: {
        periodPreset: "7",
        periodStart: "2026-08-18T12:00:00.000Z",
      },
      valid: true,
    });

    const allHistory = parseTherapistSessionFilters({ period: "all" });
    expect(allHistory).toMatchObject({
      filters: {
        periodPreset: "all",
        periodStart: undefined,
        periodEnd: undefined,
      },
      valid: true,
    });
  });

  it("parses status filters and ignores the removed payment filter", () => {
    const result = parseTherapistSessionFilters({
      cursorBookingId: "f2000000-0000-4000-8000-000000000001",
      cursorStartsAt: "2026-07-26T13:00:00.000Z",
      limit: "25",
      payment: "paid",
      periodEnd: "2026-08-01T00:00:00.000Z",
      periodStart: "2026-07-01T00:00:00.000Z",
      status: BookingStatus.Confirmed,
    });

    expect(result).toEqual({
      filters: expect.objectContaining({
        bookingStatus: BookingStatus.Confirmed,
        cursor: {
          bookingId: "f2000000-0000-4000-8000-000000000001",
          startsAt: "2026-07-26T13:00:00.000Z",
        },
        limit: 25,
      }),
      valid: true,
    });
    if (result.valid) {
      expect(result.filters).not.toHaveProperty("financialStatus");
    }
  });

  it("rejects partial cursors, invalid periods and oversized pages", () => {
    expect(
      parseTherapistSessionFilters({
        cursorStartsAt: "2026-07-26T13:00:00.000Z",
      }).valid,
    ).toBe(false);
    expect(
      parseTherapistSessionFilters({
        periodEnd: "2026-07-01T00:00:00.000Z",
        periodStart: "2026-08-01T00:00:00.000Z",
      }).valid,
    ).toBe(false);
    expect(parseTherapistSessionFilters({ limit: "101" }).valid).toBe(false);
    expect(parseTherapistSessionFilters({ modality: "in_person" }).valid).toBe(
      false,
    );
  });

  it("preserves filters when creating the next cursor URL", () => {
    const href = buildNextSessionsHref(
      {
        bookingStatus: BookingStatus.Confirmed,
        limit: 20,
      },
      {
        bookingId: "f2000000-0000-4000-8000-000000000001",
        startsAt: "2026-07-26T13:00:00.000Z",
      },
    );

    expect(href).toContain("status=confirmed");
    expect(href).not.toContain("payment=");
    expect(href).not.toContain("modality=");
    expect(href).toContain("cursorBookingId=f2000000");
  });

  it("keeps the pagination cursor independent for each session group", () => {
    const cursor = {
      bookingId: "f2000000-0000-4000-8000-000000000001",
      startsAt: "2026-07-26T13:00:00.000Z",
    };
    const href = buildNextSessionsHref(
      { limit: 20, periodPreset: "30" },
      cursor,
      "upcoming",
    );

    expect(href).toContain(
      "upcomingCursorStartsAt=2026-07-26T13%3A00%3A00.000Z",
    );
    expect(href).toContain("upcomingCursorBookingId=f2000000");
    expect(href).not.toContain("pastCursor");
    expect(buildNextSessionsHref({ limit: 20 }, cursor, "past")).toContain(
      "pastCursorBookingId=f2000000",
    );
    expect(
      parseTherapistSessionCursor(
        {
          upcomingCursorBookingId: cursor.bookingId,
          upcomingCursorStartsAt: cursor.startsAt,
        },
        "upcoming",
      ),
    ).toEqual({ cursor, valid: true });
  });

  it("starts each session group with five items and adds ten on demand", () => {
    const limits = parseTherapistSessionListLimits({}, 5);

    expect(limits).toEqual({
      limits: { past: 5, upcoming: 5 },
      valid: true,
    });

    if (!limits.valid) throw new Error("Expected valid session list limits");

    const href = buildLoadMoreSessionsHref(
      { limit: 5, periodPreset: "30" },
      "past",
      limits.limits,
    );

    expect(href).toContain("limit=5");
    expect(href).toContain("pastLimit=15");
    expect(href).toContain("upcomingLimit=5");
  });

  it("keeps a prior expanded group visible when loading the other group", () => {
    const limits = parseTherapistSessionListLimits(
      { pastLimit: "15", upcomingLimit: "5" },
      5,
    );

    expect(limits).toEqual({
      limits: { past: 15, upcoming: 5 },
      valid: true,
    });
    if (!limits.valid) throw new Error("Expected valid session list limits");

    expect(
      buildLoadMoreSessionsHref(
        { limit: 5 },
        "upcoming",
        limits.limits,
      ),
    ).toContain("pastLimit=15&upcomingLimit=15");
  });

  it("rejects invalid scoped limits", () => {
    expect(
      parseTherapistSessionListLimits({ pastLimit: "101" }, 5),
    ).toEqual({
      message: "Revise os filtros informados e tente novamente.",
      valid: false,
    });
  });
});

describe("session timezone formatting", () => {
  it("formats the same UTC instant in the business timezone", () => {
    const instant = "2026-07-26T12:30:00.000Z";

    expect(formatSessionDateTime(instant, "America/Sao_Paulo")).toContain(
      "09:30",
    );
    expect(formatSessionDateTime(instant, "America/New_York")).toContain(
      "08:30",
    );
  });

  it("falls back to the TES business timezone for invalid identifiers", () => {
    expect(formatSessionDateTime("2026-07-26T12:30:00.000Z", "invalid")).toBe(
      formatSessionDateTime("2026-07-26T12:30:00.000Z", "America/Sao_Paulo"),
    );
  });
});
