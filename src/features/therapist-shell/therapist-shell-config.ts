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
  const helpHref = routes.therapist.support;

  return {
    helpCardVariant:
      plan === TherapistPlan.PremiumPlus ? "priority" : "therapist",
    helpHref,
    navigation: buildTherapistNavigation({ plan, unreadMessagesCount }),
    plan,
    planLabel: definition.name,
  };
}
