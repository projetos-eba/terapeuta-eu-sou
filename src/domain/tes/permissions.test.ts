import { describe, expect, it } from "vitest";

import { TherapistPlan } from "./enums";
import { canUseTherapistCapability } from "./permissions";

describe("custom profile slug capability", () => {
  it("is blocked for Free and enabled for paid therapist plans", () => {
    expect(
      canUseTherapistCapability(TherapistPlan.Free, "custom_profile_slug"),
    ).toBe(false);
    expect(
      canUseTherapistCapability(TherapistPlan.Premium, "custom_profile_slug"),
    ).toBe(true);
    expect(
      canUseTherapistCapability(
        TherapistPlan.PremiumPlus,
        "custom_profile_slug",
      ),
    ).toBe(true);
  });
});

describe("session observations capability", () => {
  it("is reserved for Premium Plus", () => {
    expect(
      canUseTherapistCapability(TherapistPlan.Free, "session_observations"),
    ).toBe(false);
    expect(
      canUseTherapistCapability(TherapistPlan.Premium, "session_observations"),
    ).toBe(false);
    expect(
      canUseTherapistCapability(
        TherapistPlan.PremiumPlus,
        "session_observations",
      ),
    ).toBe(true);
  });
});
