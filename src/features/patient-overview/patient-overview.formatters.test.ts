import { describe, expect, it } from "vitest";

import { formatTimeRange } from "./patient-overview.formatters";

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
});
