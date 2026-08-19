import { describe, expect, it } from "vitest";

import { formatWeekdayLabel } from "./therapist-week-chart";

describe("formatWeekdayLabel", () => {
  it("renders weekday abbreviations in Portuguese regardless of the API label", () => {
    expect(formatWeekdayLabel("2026-08-17")).toBe("SEG");
    expect(formatWeekdayLabel("2026-08-23")).toBe("DOM");
  });
});
