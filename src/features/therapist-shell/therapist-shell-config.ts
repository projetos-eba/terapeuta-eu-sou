import {
  getTherapistPlanDefinition,
  TherapistPlan,
  type TherapistPlan as TherapistPlanValue,
} from "@/domain/tes";
import { routes } from "@/lib/routes";

import { buildTherapistNavigation } from "./therapist-navigation";
import type { TherapistShellConfig } from "./therapist-shell.types";

export function getTherapistShellConfig({
  plan,
  unreadMessagesCount,
}: {
  plan: TherapistPlanValue;
  unreadMessagesCount: number;
}): TherapistShellConfig {
  const definition = getTherapistPlanDefinition(plan);
  const helpHref =
    plan === TherapistPlan.PremiumPlus
      ? routes.therapist.plusSupport
      : plan === TherapistPlan.Premium
        ? routes.therapist.proSupport
        : routes.therapist.basicSupport;

  return {
    helpCardVariant:
      plan === TherapistPlan.PremiumPlus ? "priority" : "therapist",
    helpHref,
    navigation: buildTherapistNavigation({ plan, unreadMessagesCount }),
    plan,
    planLabel: definition.name,
  };
}
