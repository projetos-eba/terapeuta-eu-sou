import { describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";

import {
  canAccessTherapistPlan,
  getTherapistPlanLabel,
  getTherapistUpgradeLabel,
} from "./therapist-plan-access";

describe("therapist plan access", () => {
  it("allows a plan to use its own and lower-tier features", () => {
    expect(canAccessTherapistPlan(TherapistPlan.Free, TherapistPlan.Free)).toBe(
      true,
    );
    expect(
      canAccessTherapistPlan(TherapistPlan.Premium, TherapistPlan.Premium),
    ).toBe(true);
    expect(
      canAccessTherapistPlan(
        TherapistPlan.PremiumPlus,
        TherapistPlan.Premium,
      ),
    ).toBe(true);
  });

  it("does not allow Free or Premium into Premium Plus features", () => {
    expect(
      canAccessTherapistPlan(TherapistPlan.Free, TherapistPlan.PremiumPlus),
    ).toBe(false);
    expect(
      canAccessTherapistPlan(
        TherapistPlan.Premium,
        TherapistPlan.PremiumPlus,
      ),
    ).toBe(false);
  });

  it("uses the next relevant upgrade label", () => {
    expect(getTherapistPlanLabel(TherapistPlan.PremiumPlus)).toBe(
      "Premium Plus",
    );
    expect(getTherapistUpgradeLabel(TherapistPlan.Premium)).toBe(
      "Conhecer Premium",
    );
    expect(getTherapistUpgradeLabel(TherapistPlan.PremiumPlus)).toBe(
      "Conhecer Premium Plus",
    );
  });
});

