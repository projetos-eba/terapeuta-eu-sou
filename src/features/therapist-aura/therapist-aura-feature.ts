import "server-only";

import { canUseTherapistCapability, type TherapistPlan } from "@/domain/tes";

export type TherapistAuraFeatureAccess = {
  canUse: boolean;
  hasEntitlement: boolean;
  launchEnabled: boolean;
};

export function isTherapistAuraEnabled() {
  return process.env.AURA_ENABLED === "true";
}

export function getTherapistAuraFeatureAccess(
  plan: TherapistPlan,
): TherapistAuraFeatureAccess {
  const launchEnabled = isTherapistAuraEnabled();
  const hasEntitlement = canUseTherapistCapability(plan, "aura_full");

  return {
    canUse: launchEnabled && hasEntitlement,
    hasEntitlement,
    launchEnabled,
  };
}
