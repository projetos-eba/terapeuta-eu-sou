import { describe, expect, it } from "vitest";

import { buildPublicTherapistTherapyChips } from "./therapy-presentation";

describe("buildPublicTherapistTherapyChips", () => {
  it("returns no chips when there are no valid canonical therapies", () => {
    expect(buildPublicTherapistTherapyChips([])).toEqual([]);
    expect(buildPublicTherapistTherapyChips([{ name: " " }])).toEqual([]);
  });

  it("returns one, two, and three therapies without filling fake labels", () => {
    expect(
      buildPublicTherapistTherapyChips([
        { id: "reiki-id", name: "Reiki", slug: "reiki" },
      ]),
    ).toHaveLength(1);

    expect(
      buildPublicTherapistTherapyChips([
        { id: "reiki-id", name: "Reiki", slug: "reiki" },
        { id: "taro-id", name: "Tarô", slug: "taro" },
      ]),
    ).toHaveLength(2);

    expect(
      buildPublicTherapistTherapyChips([
        { id: "reiki-id", name: "Reiki", slug: "reiki" },
        { id: "taro-id", name: "Tarô", slug: "taro" },
        {
          id: "constelacao-id",
          name: "Constelação Familiar",
          slug: "constelacao-familiar",
        },
      ]),
    ).toHaveLength(3);
  });

  it("limits visible chips to three therapies", () => {
    const chips = buildPublicTherapistTherapyChips([
      { id: "1", name: "Reiki", slug: "reiki" },
      { id: "2", name: "Tarô", slug: "taro" },
      { id: "3", name: "Constelação Familiar", slug: "constelacao-familiar" },
      { id: "4", name: "Aromaterapia", slug: "aromaterapia" },
    ]);

    expect(chips.map((chip) => chip.label)).toEqual([
      "Aromaterapia",
      "Constelação Familiar",
      "Reiki",
    ]);
  });

  it("deduplicates by canonical therapy id before label", () => {
    const chips = buildPublicTherapistTherapyChips([
      {
        id: "reiki-id",
        name: "Terapia Holística",
        slug: "reiki",
        sortOrder: 1,
      },
      { id: "reiki-id", name: "Reiki", slug: "reiki", sortOrder: 2 },
      { id: "taro-id", name: "Tarô", slug: "taro", sortOrder: 3 },
    ]);

    expect(chips).toEqual([
      { id: "reiki-id", label: "Terapia Holística", slug: "reiki" },
      { id: "taro-id", label: "Tarô", slug: "taro" },
    ]);
  });

  it("uses sort order before the stable name fallback", () => {
    const chips = buildPublicTherapistTherapyChips([
      { id: "taro-id", name: "Tarô", slug: "taro", sortOrder: 2 },
      { id: "reiki-id", name: "Reiki", slug: "reiki", sortOrder: 1 },
    ]);

    expect(chips.map((chip) => chip.label)).toEqual(["Reiki", "Tarô"]);
  });
});
