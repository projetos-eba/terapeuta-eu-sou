import { describe, expect, it } from "vitest";

import {
  resolveAdminFinanceDateRange,
  shiftIsoDateByCalendarYears,
} from "./admin-finance-date-range";

describe("resolveAdminFinanceDateRange", () => {
  it("accepts a completed custom period of up to one calendar year", () => {
    expect(
      resolveAdminFinanceDateRange(
        "custom",
        "2025-09-29",
        "2026-09-29",
        "2026-09-29",
      ),
    ).toEqual({
      end: "2026-09-29",
      period: "custom",
      start: "2025-09-29",
    });
  });

  it("falls back safely for future, inverted, and longer ranges", () => {
    expect(
      resolveAdminFinanceDateRange(
        "custom",
        "2025-09-28",
        "2026-09-29",
        "2026-09-29",
      ),
    ).toEqual({ period: "30d" });
    expect(
      resolveAdminFinanceDateRange(
        "custom",
        "2026-09-29",
        "2026-09-30",
        "2026-09-29",
      ),
    ).toEqual({ period: "30d" });
  });

  it("uses the last calendar day for leap-year boundaries", () => {
    expect(shiftIsoDateByCalendarYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(
      resolveAdminFinanceDateRange(
        "custom",
        "2024-02-29",
        "2025-02-28",
        "2025-02-28",
      ),
    ).toEqual({
      end: "2025-02-28",
      period: "custom",
      start: "2024-02-29",
    });
  });
});
