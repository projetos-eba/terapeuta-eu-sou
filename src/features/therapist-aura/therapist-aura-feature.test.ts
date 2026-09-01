import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapistPlan } from "@/domain/tes";

import {
  getTherapistAuraFeatureAccess,
  isTherapistAuraEnabled,
} from "./therapist-aura-feature";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Assessora Aura feature gate", () => {
  it.each([undefined, "false", "TRUE", "1", "invalid"])(
    "fails closed for AURA_ENABLED=%s",
    (value) => {
      if (value === undefined) vi.stubEnv("AURA_ENABLED", "");
      else vi.stubEnv("AURA_ENABLED", value);

      expect(isTherapistAuraEnabled()).toBe(false);
    },
  );

  it("requires both the launch flag and Premium Plus entitlement", () => {
    vi.stubEnv("AURA_ENABLED", "true");

    expect(
      getTherapistAuraFeatureAccess(TherapistPlan.PremiumPlus),
    ).toMatchObject({
      canUse: true,
      hasEntitlement: true,
      launchEnabled: true,
    });
    expect(getTherapistAuraFeatureAccess(TherapistPlan.Premium)).toMatchObject({
      canUse: false,
      hasEntitlement: false,
      launchEnabled: true,
    });
  });
});
