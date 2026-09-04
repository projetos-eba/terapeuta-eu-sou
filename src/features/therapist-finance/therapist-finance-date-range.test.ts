import { describe, expect, it } from "vitest";

import { resolveTherapistFinanceDateRange } from "./therapist-finance-date-range";

describe("resolveTherapistFinanceDateRange", () => {
  it("accepts a typed custom period of up to 366 days", () => {
    expect(
      resolveTherapistFinanceDateRange(
        "custom",
        "2026-01-10",
        "2026-02-15",
        "2026-09-03",
      ),
    ).toEqual({ end: "2026-02-15", key: "custom", start: "2026-01-10" });
  });

  it("falls back safely when a custom period is invalid or too long", () => {
    expect(
      resolveTherapistFinanceDateRange(
        "custom",
        "2025-01-01",
        "2026-09-03",
        "2026-09-03",
      ),
    ).toEqual({ end: "2026-09-03", key: "30", start: "2026-08-05" });
  });
});
