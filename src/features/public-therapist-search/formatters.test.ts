import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatNextSlotLabel,
  getAvailabilityBucket,
} from "./formatters";

describe("public therapist availability formatters", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("classifies a slot using the therapist timezone instead of the server day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T23:30:00.000Z"));

    expect(
      getAvailabilityBucket(
        "2026-08-25T02:00:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe("today");
    expect(
      formatNextSlotLabel(
        "2026-08-25T02:00:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe("Hoje, 23:00");
  });

  it("formats later dates in the canonical schedule timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T13:00:00.000Z"));

    expect(
      formatNextSlotLabel(
        "2026-08-26T12:10:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe("qua, 09:10");
  });
});
