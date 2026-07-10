import {
  canAccessAdvancedFinancials,
  canAccessAdvancedMetrics,
  canAccessAura,
  canAccessFullCrm,
  canAccessStrategicReviews,
  canRequestNewTherapy,
  canUseAgendaInsights,
  canUseTherapistCapability,
  normalizeLegacyTherapistPlan,
  TherapistPlan,
  UserRole,
  type TherapistCapability,
} from "@/domain/tes";

export { TherapistPlan, UserRole };
export type { TherapistCapability };

export type LegacyTherapistPlan = "basic" | "pro" | "plus";

export type LegacyTherapistCapability =
  | "sessions"
  | "messages"
  | "limitedServices"
  | "completeFinance"
  | "reviews"
  | "intermediateMetrics"
  | "advancedInsights"
  | "auraRecommendations"
  | "patientJourneyHistory"
  | "prioritySupport";

const legacyCapabilityMap: Record<
  LegacyTherapistCapability,
  TherapistCapability
> = {
  sessions: "operation_essentials",
  messages: "operation_essentials",
  limitedServices: "operation_essentials",
  completeFinance: "advanced_financials",
  reviews: "strategic_reviews",
  intermediateMetrics: "advanced_metrics",
  advancedInsights: "aura_full",
  auraRecommendations: "aura_limited",
  patientJourneyHistory: "full_crm",
  prioritySupport: "full_crm",
};

export const therapistCapabilities = legacyCapabilityMap;

export function canUseCapability(
  plan: TherapistPlan | LegacyTherapistPlan,
  capability: LegacyTherapistCapability,
) {
  return canUseTherapistCapability(
    normalizeLegacyTherapistPlan(plan),
    legacyCapabilityMap[capability],
  );
}

export {
  canAccessAdvancedFinancials,
  canAccessAdvancedMetrics,
  canAccessAura,
  canAccessFullCrm,
  canAccessStrategicReviews,
  canRequestNewTherapy,
  canUseAgendaInsights,
  canUseTherapistCapability,
  normalizeLegacyTherapistPlan,
};
