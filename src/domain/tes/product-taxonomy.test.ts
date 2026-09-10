import { describe, expect, it } from "vitest";

import { therapistPlanDefinitions } from "./plan-definitions";

describe("product taxonomy guardrails", () => {
  it("uses canonical commercial plan names", () => {
    expect(therapistPlanDefinitions.map((plan) => plan.name)).toEqual([
      "Free",
      "Premium",
      "Premium Plus",
    ]);
  });

  it("does not use isolated Plus as new commercial copy in plan definitions", () => {
    const planCopy = JSON.stringify(therapistPlanDefinitions);

    expect(planCopy).not.toMatch(/exclusivo Plus|plano Plus|TES Plus/);
  });

  it("keeps featured benefits included in their respective plans", () => {
    for (const plan of therapistPlanDefinitions) {
      expect(plan.featuredFeatures).toHaveLength(3);
      expect(
        plan.featuredFeatures.every((feature) =>
          plan.features.includes(feature),
        ),
      ).toBe(true);
    }
  });
});
