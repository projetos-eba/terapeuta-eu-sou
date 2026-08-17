import {
  getTherapistPlanDefinition,
  type TherapistPlan as TherapistPlanValue,
} from "@/domain/tes";

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

  return {
    navigation: buildTherapistNavigation({ plan, unreadMessagesCount }),
    plan,
    planLabel: definition.name,
  };
}
