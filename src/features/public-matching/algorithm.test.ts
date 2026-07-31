import { describe, expect, it } from "vitest";

import { calculateMatchingResults } from "./algorithm";
import type { MatchingConfig, MatchingTherapy, MatchingWeight } from "./types";

const config: MatchingConfig = {
  source: "fallback",
  themes: [
    {
      description: "Tema",
      id: "theme-1",
      imageUrl: null,
      interests: [{ id: "interest-1", name: "Interesse", slug: "interesse", sortOrder: 1, themeId: "theme-1" }],
      name: "Tema",
      slug: "tema",
      sortOrder: 1,
    },
  ],
  version: 1,
  versionId: "version-1",
};

const therapies: MatchingTherapy[] = [
  {
    description: "Reiki",
    id: "therapy-reiki",
    imageUrl: "/therapies/reiki-editorial.png",
    isVisibleInMatching: true,
    name: "Reiki",
    shortDescription: "Reiki",
    slug: "reiki",
    status: "published",
    therapistCount: 2,
  },
  {
    description: "Tarô",
    id: "therapy-taro",
    imageUrl: "/therapies/taro-editorial.png",
    isVisibleInMatching: false,
    name: "Tarô",
    shortDescription: "Tarô",
    slug: "taro",
    status: "published",
    therapistCount: 1,
  },
];

const weights: MatchingWeight[] = [
  {
    interestId: null,
    isActive: true,
    themeId: "theme-1",
    therapyId: "therapy-reiki",
    weight: 5,
  },
  {
    interestId: null,
    isActive: true,
    themeId: "theme-1",
    therapyId: "therapy-taro",
    weight: 5,
  },
];

describe("calculateMatchingResults", () => {
  it("keeps therapy image associated with the matched canonical therapy", () => {
    const result = calculateMatchingResults({
      config,
      selection: {
        interestIds: [],
        source: "journey",
        themeIds: ["theme-1"],
      },
      source: "supabase",
      therapies,
      versionId: "version-1",
      weights,
    });

    expect(result.results).toEqual([
      expect.objectContaining({
        imageUrl: "/therapies/reiki-editorial.png",
        slug: "reiki",
        therapyId: "therapy-reiki",
        title: "Reiki",
      }),
    ]);
  });
});
