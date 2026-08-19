import { describe, expect, it } from "vitest";

import { bioIllustrationById, bioIllustrations } from "./personalization";

describe("official bio illustrations", () => {
  it("keeps persisted IDs while resolving them to the approved PNG artwork", () => {
    expect(bioIllustrations).toHaveLength(4);
    expect(bioIllustrationById.organic_flow).toMatchObject({
      label: "Planta serena",
      src: "/therapists/profile-bio/serene-plant.png",
    });
    expect(bioIllustrationById.gentle_horizon).toMatchObject({
      label: "Planta natural",
      src: "/therapists/profile-bio/natural-plant.png",
    });
    expect(bioIllustrationById.warm_layers).toMatchObject({
      label: "Canto acolhedor",
      src: "/therapists/profile-bio/warm-chair.png",
    });
    expect(bioIllustrationById.essential_lines).toMatchObject({
      label: "Folhas essenciais",
      src: "/therapists/profile-bio/essential-leaves.png",
    });
  });
});
