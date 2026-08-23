import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";

import {
  canUsePublicProfileTheme,
  publicProfileThemes,
} from "./personalization";

describe("public profile theme catalog", () => {
  it("keeps the four Free themes and fifteen Premium themes unique", () => {
    expect(publicProfileThemes).toHaveLength(19);
    expect(new Set(publicProfileThemes.map((theme) => theme.id)).size).toBe(19);
    expect(publicProfileThemes.filter((theme) => theme.tier === "free")).toHaveLength(4);
    expect(publicProfileThemes.filter((theme) => theme.tier === "premium")).toHaveLength(15);
  });

  it("defines a deterministic shape and a versioned asset for every library theme", () => {
    for (const theme of publicProfileThemes) {
      expect(["circle", "arch", "oval", "square"]).toContain(theme.photoShape);
      const asset = theme.backgroundAsset ?? theme.heroBackgroundSrc;
      if (asset) {
        expect(existsSync(resolve(process.cwd(), "public", asset.slice(1)))).toBe(
          true,
        );
      }
    }
  });

  it("applies entitlement consistently across current therapist plans", () => {
    const freeTheme = publicProfileThemes.find((theme) => theme.tier === "free");
    const premiumTheme = publicProfileThemes.find(
      (theme) => theme.tier === "premium",
    );

    expect(freeTheme).toBeDefined();
    expect(premiumTheme).toBeDefined();
    expect(canUsePublicProfileTheme(TherapistPlan.Free, freeTheme!)).toBe(true);
    expect(canUsePublicProfileTheme(TherapistPlan.Free, premiumTheme!)).toBe(
      false,
    );
    expect(canUsePublicProfileTheme(TherapistPlan.Premium, premiumTheme!)).toBe(
      true,
    );
    expect(
      canUsePublicProfileTheme(TherapistPlan.PremiumPlus, premiumTheme!),
    ).toBe(true);
  });
});
