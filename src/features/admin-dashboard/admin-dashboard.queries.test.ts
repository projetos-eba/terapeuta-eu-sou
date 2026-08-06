import { describe, expect, it } from "vitest";

import { parseContentRangeTotal } from "./admin-dashboard.utils";

describe("admin dashboard queries", () => {
  it("parses exact PostgREST content-range totals", () => {
    expect(parseContentRangeTotal("0-0/42")).toBe(42);
    expect(parseContentRangeTotal("*/0")).toBe(0);
  });

  it("treats absent or unknown totals as unavailable", () => {
    expect(parseContentRangeTotal(null)).toBeNull();
    expect(parseContentRangeTotal("0-0/*")).toBeNull();
    expect(parseContentRangeTotal("invalid")).toBeNull();
  });
});
