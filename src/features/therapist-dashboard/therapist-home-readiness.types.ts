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

export type TherapistHomeDocument = {
  complete: boolean;
  description: string;
  id: "address_proof" | "identity_document";
  state: "attention" | "complete" | "pending";
  title: string;
};

export type TherapistHomeProfileSummary = {
  city: string;
  headline: string;
  publicName: string;
  state: string;
};

export type TherapistHomeReadiness = {
  checklist: TherapistHomeChecklistItem[];
  completedRequiredCount: number;
  documents: TherapistHomeDocument[];
  isOperationallyReady: boolean;
  plan: TherapistPlan;
  profileCompleteness: number;
  profileSummary: TherapistHomeProfileSummary;
  profilePublicStatus: string;
  requiredCount: number;
  therapistStatus: TherapistStatus;
  verificationStatus: string;
};
