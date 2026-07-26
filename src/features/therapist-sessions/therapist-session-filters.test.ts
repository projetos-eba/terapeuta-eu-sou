import { describe, expect, it } from "vitest";

import {
  BookingStatus,
  SessionFinancialStatus,
} from "@/domain/tes";
import { formatSessionDateTime } from "@/features/bookings";

import {
  buildNextSessionsHref,
  parseTherapistSessionFilters,
} from "./therapist-session-filters";

describe("therapist session filters", () => {
  it("parses versionable URL filters and cursor pagination", () => {
    const result = parseTherapistSessionFilters({
      cursorBookingId: "f2000000-0000-4000-8000-000000000001",
      cursorStartsAt: "2026-07-26T13:00:00.000Z",
      limit: "25",
      modality: "online",
      payment: SessionFinancialStatus.Paid,
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
        financialStatus: SessionFinancialStatus.Paid,
        limit: 25,
        modality: "online",
      }),
      valid: true,
    });
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
  });

  it("preserves filters when creating the next cursor URL", () => {
    const href = buildNextSessionsHref(
      {
        bookingStatus: BookingStatus.Confirmed,
        financialStatus: SessionFinancialStatus.Paid,
        limit: 20,
        modality: "online",
      },
      {
        bookingId: "f2000000-0000-4000-8000-000000000001",
        startsAt: "2026-07-26T13:00:00.000Z",
      },
    );

    expect(href).toContain("status=confirmed");
    expect(href).toContain("payment=paid");
    expect(href).toContain("cursorBookingId=f2000000");
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
      formatSessionDateTime(
        "2026-07-26T12:30:00.000Z",
        "America/Sao_Paulo",
      ),
    );
  });
});
