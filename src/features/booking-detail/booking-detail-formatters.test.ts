import { describe, expect, it } from "vitest";

import {
  formatSessionDate,
  formatSessionTimeRange,
} from "./booking-detail-formatters";

describe("booking detail formatters", () => {
  it("uses the booking timezone for the patient-facing date and time", () => {
    const startsAt = "2026-08-24T12:10:00.000Z";
    const endsAt = "2026-08-24T13:10:00.000Z";

    expect(
      formatSessionTimeRange(startsAt, endsAt, "America/Sao_Paulo"),
    ).toBe("09:10 - 10:10");
    expect(formatSessionDate(startsAt, "America/Sao_Paulo")).toContain("24");
  });
});
