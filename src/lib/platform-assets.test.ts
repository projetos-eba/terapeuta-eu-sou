import { describe, expect, it } from "vitest";

import { platformAssets } from "./platform-assets";

describe("platformAssets", () => {
  it("keeps the complete production asset inventory in approved public directories", () => {
    expect(Object.values(platformAssets)).toHaveLength(21);

    for (const asset of Object.values(platformAssets)) {
      expect(asset.src).toMatch(
        /^(\/assets\/plataforma|\/therapist\/(?:aura|dashboard))\/.+\.png$/,
      );
    }
  });

  it("does not ship the Figma reference that includes banner text", () => {
    expect(JSON.stringify(platformAssets)).not.toContain("fundo-e-texto");
  });
});
