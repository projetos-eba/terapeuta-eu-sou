import { describe, expect, it } from "vitest";

import { TherapistPlan } from "./enums";
import {
  canUpgradeTherapistPlan,
  getTherapistDowngradeOptions,
  getTherapistUpgradeOptions,
  isPaidTherapistPlan,
} from "./plans";

describe("therapist plan transitions", () => {
  it("offers only higher plans on the acquisition path", () => {
    expect(getTherapistUpgradeOptions(TherapistPlan.Free)).toEqual([
      TherapistPlan.Premium,
      TherapistPlan.PremiumPlus,
    ]);
    expect(getTherapistUpgradeOptions(TherapistPlan.Premium)).toEqual([
      TherapistPlan.PremiumPlus,
    ]);
    expect(getTherapistUpgradeOptions(TherapistPlan.PremiumPlus)).toEqual([]);
    expect(canUpgradeTherapistPlan(TherapistPlan.PremiumPlus)).toBe(false);
  });

  it("keeps cancellation distinct from the supported paid downgrade", () => {
    expect(getTherapistDowngradeOptions(TherapistPlan.PremiumPlus)).toEqual([
      TherapistPlan.Premium,
    ]);
    expect(getTherapistDowngradeOptions(TherapistPlan.Premium)).toEqual([]);
    expect(isPaidTherapistPlan(TherapistPlan.Free)).toBe(false);
    expect(isPaidTherapistPlan(TherapistPlan.Premium)).toBe(true);
  });
});
