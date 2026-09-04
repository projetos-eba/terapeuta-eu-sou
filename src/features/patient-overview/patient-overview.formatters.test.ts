import { describe, expect, it } from "vitest";

import {
  formatShortDate,
  formatTimeRange,
} from "./patient-overview.formatters";

describe("patient overview formatters", () => {
  it("formats appointment times in the agenda timezone", () => {
    expect(
      formatTimeRange(
        "2026-08-24T12:10:00.000Z",
        "2026-08-24T13:00:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe("09:10 - 10:00");
  });

  it("formats date-only support timestamps in Brasília time", () => {
    expect(formatShortDate("2026-09-01T02:30:00.000Z")).toBe("31 de ago.");
  });
});
