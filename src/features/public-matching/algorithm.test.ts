import { describe, expect, it } from "vitest";

import { calculateMatchingResults } from "./algorithm";
import type { MatchingConfig, MatchingTherapy, MatchingWeight } from "./types";

const config: MatchingConfig = {
  source: "demo",
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
    sortOrder: 1,
    status: "published",
    themeIds: ["theme-1"],
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
    sortOrder: 2,
    status: "published",
    themeIds: ["theme-1"],
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
        matchingVersionId: "version-1",
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

  it("does not let selected interests change therapy ranking", () => {
    const resultWithoutInterest = calculateMatchingResults({
      config,
      selection: {
        interestIds: [],
        matchingVersionId: "version-1",
        source: "journey",
        themeIds: ["theme-1"],
      },
      source: "supabase",
      therapies,
      versionId: "version-1",
      weights,
    });
    const resultWithInterest = calculateMatchingResults({
      config,
      selection: {
        interestIds: ["interest-1"],
        matchingVersionId: "version-1",
        source: "journey",
        themeIds: ["theme-1"],
      },
      source: "supabase",
      therapies,
      versionId: "version-1",
      weights: [
        ...weights,
        {
          interestId: "interest-1",
          isActive: true,
          themeId: null,
          therapyId: "therapy-taro",
          weight: 5,
        },
      ],
    });

    expect(resultWithInterest.results.map((item) => item.therapyId)).toEqual(
      resultWithoutInterest.results.map((item) => item.therapyId),
    );
  });

  it("labels the real number of matched themes instead of deriving labels from percentages", () => {
    const result = calculateMatchingResults({
      config: {
        ...config,
        themes: [
          ...config.themes,
          {
            description: "Tema 2",
            id: "theme-2",
            imageUrl: null,
            interests: [],
            name: "Tema 2",
            slug: "tema-2",
            sortOrder: 2,
          },
        ],
      },
      selection: {
        interestIds: [],
        matchingVersionId: "version-1",
        source: "journey",
        themeIds: ["theme-1"],
      },
      source: "supabase",
      therapies: [
        {
          ...therapies[0],
          themeIds: ["theme-1", "theme-2"],
        },
      ],
      versionId: "version-1",
      weights,
    });

    expect(result.results[0]?.label).toBe("1 tema em comum");
    expect(result.results[0]?.scorePercent).toBe(100);
  });
});
