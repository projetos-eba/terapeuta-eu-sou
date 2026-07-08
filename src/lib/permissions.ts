export type TherapistPlan = 'basic' | 'pro' | 'plus';
export type UserRole = 'visitor' | 'patient' | 'therapist' | 'admin';

export const therapistCapabilities: Record<string, TherapistPlan[]> = {
  sessions: ['basic', 'pro', 'plus'],
  messages: ['basic', 'pro', 'plus'],
  limitedServices: ['basic', 'pro', 'plus'],
  completeFinance: ['pro', 'plus'],
  reviews: ['pro', 'plus'],
  intermediateMetrics: ['pro', 'plus'],
  advancedInsights: ['plus'],
  aiRecommendations: ['plus'],
  patientJourneyHistory: ['plus'],
  prioritySupport: ['plus'],
};

export function canUseCapability(plan: TherapistPlan, capability: keyof typeof therapistCapabilities) {
  return therapistCapabilities[capability].includes(plan);
}
