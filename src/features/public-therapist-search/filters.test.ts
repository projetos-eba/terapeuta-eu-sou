import { describe, expect, it } from "vitest";

import { THERAPIST_SEARCH_PAGE_SIZE } from "./content";
import { parseTherapistSearchParams, toSearchParams } from "./filters";

describe("public therapist search filters", () => {
  it("keeps valid URL filters and normalizes the page", () => {
    expect(
      parseTherapistSearchParams({
        availability: "tomorrow",
        page: "3",
        price: "100-150",
        q: "  Reiki  ",
        rating: "4-plus",
        sort: "rating",
        theme: "equilibrio-emocional",
        therapy: "reiki",
      }),
    ).toEqual({
      availability: "tomorrow",
      page: 3,
      price: "100-150",
      q: "Reiki",
      rating: "4-plus",
      sort: "rating",
      theme: "equilibrio-emocional",
      therapy: "reiki",
    });
  });

  it("serializes selected filters without retaining an obsolete page", () => {
    const filters = parseTherapistSearchParams({
      page: "2",
      sort: "price_asc",
      therapy: "reiki",
    });

    expect(toSearchParams(filters, { page: 1 })).toBe(
      "therapy=reiki&sort=price_asc",
    );
  });

  it("shows up to eight therapist cards on each result page", () => {
    expect(THERAPIST_SEARCH_PAGE_SIZE).toBe(8);
  });
});
