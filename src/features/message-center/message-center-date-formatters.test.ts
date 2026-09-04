import { describe, expect, it } from "vitest";

import {
  formatMessageRelativeTime,
  formatMessageSessionContext,
  formatMessageTimestamp,
} from "./message-center-date-formatters";

describe("message center date formatters", () => {
  const instant = "2026-08-28T14:47:00.000Z";

  it("formats message timestamps in the requested timezone", () => {
    expect(formatMessageTimestamp(instant, "America/Sao_Paulo")).toContain(
      "11:47",
    );
    expect(formatMessageTimestamp(instant, "UTC")).toContain("14:47");
  });

  it("formats session context with the booking timezone", () => {
    expect(formatMessageSessionContext(instant, "America/Sao_Paulo")).toContain(
      "11:47",
    );
  });

  it("keeps relative labels stable across server and browser runtimes", () => {
    const now = new Date("2026-08-28T15:00:00.000Z");

    expect(
      formatMessageRelativeTime(instant, "America/Sao_Paulo", now),
    ).toContain("Hoje · 11:47");
  });

  it("falls back to the TES business timezone for invalid values", () => {
    expect(formatMessageTimestamp(instant, "invalid/timezone")).toBe(
      formatMessageTimestamp(instant, "America/Sao_Paulo"),
    );
  });
});
