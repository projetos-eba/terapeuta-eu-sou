import type { ShellNavigationItem } from "@/components/authenticated-shell";
import type { TherapistPlan } from "@/domain/tes";

export type TherapistShellNavigation = ShellNavigationItem[];

export type TherapistShellConfig = {
  navigation: TherapistShellNavigation;
  planLabel: string;
  plan: TherapistPlan;
};
