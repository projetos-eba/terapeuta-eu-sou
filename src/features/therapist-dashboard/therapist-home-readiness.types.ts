import type { TherapistPlan, TherapistStatus } from "@/domain/tes";

export type TherapistHomeChecklistState =
  | "attention"
  | "complete"
  | "in_review"
  | "pending";

export type TherapistHomeChecklistItem = {
  actionLabel: string;
  complete: boolean;
  description: string;
  href: string;
  id: "agenda" | "connect" | "profile" | "services";
  required: boolean;
  state: TherapistHomeChecklistState;
  title: string;
};

export type TherapistHomeReadiness = {
  checklist: TherapistHomeChecklistItem[];
  completedRequiredCount: number;
  isOperationallyReady: boolean;
  plan: TherapistPlan;
  profileCompleteness: number;
  profilePublicStatus: string;
  requiredCount: number;
  therapistStatus: TherapistStatus;
};
