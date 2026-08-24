import { TherapistPlan, isTherapistPlanAtLeast } from "@/domain/tes";

export function canAccessTherapistPlan(
  currentPlan: TherapistPlan,
  requiredPlan: TherapistPlan,
) {
  return isTherapistPlanAtLeast(currentPlan, requiredPlan);
}

export function getTherapistPlanLabel(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return "Premium Plus";
  if (plan === TherapistPlan.Premium) return "Premium";
  return "Free";
}

export function getTherapistUpgradeLabel(plan: TherapistPlan) {
  return plan === TherapistPlan.PremiumPlus
    ? "Conhecer Premium Plus"
    : "Conhecer Premium";
}

