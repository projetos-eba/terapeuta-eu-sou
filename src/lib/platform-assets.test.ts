import { describe, expect, it } from "vitest";

import { platformAssets } from "./platform-assets";

describe("platformAssets", () => {
  it("keeps production assets in the dedicated public directory", () => {
    expect(Object.values(platformAssets)).toHaveLength(17);

    for (const asset of Object.values(platformAssets)) {
      expect(asset.src).toMatch(/^\/assets\/plataforma\/.+\.png$/);
    }
  });

  it("does not ship the Figma reference that includes banner text", () => {
    expect(JSON.stringify(platformAssets)).not.toContain("fundo-e-texto");
  });
});
