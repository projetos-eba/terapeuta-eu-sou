import type { TherapistPlan } from "@/domain/tes";

export type TherapistBillingStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "paused"
  | "trialing"
  | "unpaid";

export type TherapistPlanCatalogItem = {
  code: TherapistPlan;
  currency: string;
  description: string;
  interval: "month" | "year" | null;
  name: string;
  unitAmountCents: number;
};

export type TherapistSubscriptionSummary = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  plan: TherapistPlan;
  scheduledChangeAt: string | null;
  scheduledPlan: TherapistPlan | null;
  status: TherapistBillingStatus;
};

export type TherapistPlanPageData = {
  catalog: TherapistPlanCatalogItem[];
  effectivePlan: TherapistPlan;
  subscription: TherapistSubscriptionSummary | null;
};
