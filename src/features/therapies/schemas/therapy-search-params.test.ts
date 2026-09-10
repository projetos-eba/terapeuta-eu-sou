import { describe, expect, it } from "vitest";

import {
  parseTherapySearchParams,
  therapySortOptions,
} from "./therapy-search-params";

describe("therapy search parameters", () => {
  it("keeps only the three catalog sort options", () => {
    expect(therapySortOptions).toEqual([
      { label: "Mais procuradas", value: "most_searched" },
      { label: "Adicionadas recentemente", value: "newest" },
      { label: "A–Z", value: "az" },
    ]);
  });

  it("normalizes removed sort values to most searched", () => {
    expect(parseTherapySearchParams({ sort: "popular" }).sort).toBe(
      "most_searched",
    );
    expect(parseTherapySearchParams({ sort: "relevance" }).sort).toBe(
      "most_searched",
    );
  });
});
