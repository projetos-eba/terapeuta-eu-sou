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

export function isPaidTherapistPlan(plan: TherapistPlan) {
  return plan !== TherapistPlan.Free;
}

export function getTherapistUpgradeOptions(plan: TherapistPlan) {
  return (Object.values(TherapistPlan) as TherapistPlan[]).filter(
    (candidate) => therapistPlanLevels[candidate] > therapistPlanLevels[plan],
  );
}

export function getTherapistDowngradeOptions(plan: TherapistPlan) {
  if (plan === TherapistPlan.PremiumPlus) return [TherapistPlan.Premium];
  return [];
}

export function canUpgradeTherapistPlan(plan: TherapistPlan) {
  return getTherapistUpgradeOptions(plan).length > 0;
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
