import { TherapistPlan, type TherapistCapability } from "@/domain/tes";

export type TherapistRoutePolicy = {
  capability?: TherapistCapability;
  minimumPlan?: TherapistPlan;
  namespace: "basico" | "plus" | "pro";
};

export const therapistRoutePolicies = {
  basico: {
    namespace: "basico",
  },
  plus: {
    minimumPlan: TherapistPlan.PremiumPlus,
    namespace: "plus",
  },
  pro: {
    minimumPlan: TherapistPlan.Premium,
    namespace: "pro",
  },
} satisfies Record<string, TherapistRoutePolicy>;
