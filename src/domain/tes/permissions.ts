import { TherapistPlan } from "./enums";
import { therapistPlanDefinitions, therapistPlanFeatureDefinitions } from "./plan-definitions";
import { isTherapistPlanAtLeast } from "./plans";

export type AuraAccessLevel = "limited" | "full";

export type TherapistCapability =
  | "operation_essentials"
  | "advanced_metrics"
  | "aura_limited"
  | "aura_full"
  | "full_crm"
  | "strategic_reviews"
  | "advanced_financials"
  | "agenda_insights"
  | "request_new_therapy";

export const therapistPlanCapabilities: Record<
  TherapistPlan,
  TherapistCapability[]
> = Object.fromEntries(
  therapistPlanDefinitions.map((plan) => {
    const capabilities = plan.features
      .map((featureCode) =>
        therapistPlanFeatureDefinitions.find(
          (feature) => feature.code === featureCode,
        )?.capability,
      )
      .filter((capability): capability is TherapistCapability => Boolean(capability));

    return [plan.code, Array.from(new Set(capabilities))];
  }),
) as Record<TherapistPlan, TherapistCapability[]>;

export function canUseTherapistCapability(
  plan: TherapistPlan,
  capability: TherapistCapability,
) {
  return therapistPlanCapabilities[plan].includes(capability);
}

export function canAccessAdvancedMetrics(plan: TherapistPlan) {
  return isTherapistPlanAtLeast(plan, TherapistPlan.Premium);
}

export function canAccessAura(
  plan: TherapistPlan,
  accessLevel: AuraAccessLevel = "limited",
) {
  if (plan === TherapistPlan.PremiumPlus) {
    return true;
  }

  return plan === TherapistPlan.Premium && accessLevel === "limited";
}

export function canAccessFullCrm(plan: TherapistPlan) {
  return plan === TherapistPlan.PremiumPlus;
}

export function canAccessStrategicReviews(plan: TherapistPlan) {
  return plan === TherapistPlan.PremiumPlus;
}

export function canAccessAdvancedFinancials(plan: TherapistPlan) {
  return plan === TherapistPlan.PremiumPlus;
}

export function canUseAgendaInsights(plan: TherapistPlan) {
  return isTherapistPlanAtLeast(plan, TherapistPlan.Premium);
}

export function canRequestNewTherapy(plan: TherapistPlan) {
  return isTherapistPlanAtLeast(plan, TherapistPlan.Premium);
}
