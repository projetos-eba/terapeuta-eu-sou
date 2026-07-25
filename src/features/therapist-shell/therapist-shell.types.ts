import type { ShellNavigationItem } from "@/components/authenticated-shell";
import type { TherapistPlan } from "@/domain/tes";

export type TherapistShellNavigation = ShellNavigationItem[];

export type TherapistShellConfig = {
  helpCardVariant: "default" | "priority" | "therapist";
  helpHref: string;
  navigation: TherapistShellNavigation;
  planLabel: string;
  plan: TherapistPlan;
};
