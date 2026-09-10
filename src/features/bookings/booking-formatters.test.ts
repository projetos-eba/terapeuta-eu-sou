import { describe, expect, it } from "vitest";

import { formatBookingReminderSchedule } from "./booking-formatters";

describe("booking formatters", () => {
  it("formats the reminder with the booking timezone and a relative day", () => {
    expect(
      formatBookingReminderSchedule(
        "2026-08-01T14:10:00.000Z",
        "America/Sao_Paulo",
        new Date("2026-08-01T12:00:00.000Z"),
      ),
    ).toBe("Hoje, 11h10");
  });
});
