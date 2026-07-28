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
});
