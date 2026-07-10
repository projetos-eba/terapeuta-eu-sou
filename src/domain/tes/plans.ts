import { TherapistPlan } from "./enums";

export const therapistPlanLabels: Record<TherapistPlan, string> = {
  [TherapistPlan.Free]: "Free",
  [TherapistPlan.Premium]: "Premium",
  [TherapistPlan.PremiumPlus]: "Premium Plus",
};

export const therapistPlanDescriptions: Record<TherapistPlan, string> = {
  [TherapistPlan.Free]: "Operação essencial para começar com clareza.",
  [TherapistPlan.Premium]:
    "Operação com sinais e recomendações determinísticas de apoio.",
  [TherapistPlan.PremiumPlus]:
    "Operação, inteligência determinística e recursos de gestão mais completos.",
};

export const therapistPlanLevels: Record<TherapistPlan, number> = {
  [TherapistPlan.Free]: 1,
  [TherapistPlan.Premium]: 2,
  [TherapistPlan.PremiumPlus]: 3,
};

export function isTherapistPlanAtLeast(
  plan: TherapistPlan,
  minimumPlan: TherapistPlan,
) {
  return therapistPlanLevels[plan] >= therapistPlanLevels[minimumPlan];
}

export function normalizeLegacyTherapistPlan(plan: string): TherapistPlan {
  const legacyPlanMap: Record<string, TherapistPlan> = {
    basic: TherapistPlan.Free,
    pro: TherapistPlan.Premium,
    plus: TherapistPlan.PremiumPlus,
  };

  if (plan in legacyPlanMap) {
    return legacyPlanMap[plan];
  }

  if (
    plan === TherapistPlan.Free ||
    plan === TherapistPlan.Premium ||
    plan === TherapistPlan.PremiumPlus
  ) {
    return plan;
  }

  return TherapistPlan.Free;
}
