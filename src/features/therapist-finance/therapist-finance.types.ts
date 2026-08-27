export type TherapistFinanceTab =
  | "account"
  | "payouts"
  | "receipts"
  | "summary";

export type TherapistFinancePeriodKey = "30" | "90" | "month";

export type TherapistFinancialStatus =
  | "canceled"
  | "disputed"
  | "failed"
  | "paid"
  | "partially_refunded"
  | "pending"
  | "processing"
  | "refunded";

export type TherapistPayoutStatus =
  | "batched"
  | "blocked"
  | "eligible"
  | "failed"
  | "reversed"
  | "transferred"
  | "transfer_pending"
  | "waiting_confirmation"
  | "waiting_safety_period";

export type TherapistConnectOnboardingStatus =
  | "account_created"
  | "disabled"
  | "not_started"
  | "onboarding_started"
  | "ready"
  | "requirements_due"
  | "restricted";

export type TherapistFinancePagination = {
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type TherapistFinancePeriod = {
  periodEnd: string;
  periodStart: string;
  timezone: string;
};

export type TherapistFinancialOverview = TherapistFinancePeriod & {
  blockedCents: number;
  contractVersion: 1;
  disputedCents: number;
  eligibleForPayoutCents: number;
  generatedAt: string;
  grossPaidCents: number;
  payoutProcessingCents: number;
  plan: "free" | "premium" | "premium_plus";
  refundedToCustomersCents: number;
  tesCommissionCents: number;
  therapistNetCents: number;
  therapistProfileId: string;
  transferredCents: number;
  waitingConfirmationCents: number;
  waitingSafetyPeriodCents: number;
};

export type TherapistReceiptItem = {
  bookingId: string;
  createdAt: string;
  disputeStatus: string | null;
  financialStatus: TherapistFinancialStatus;
  grossAmountCents: number;
  patientDisplayName: string;
  paymentMethodType: string | null;
  paymentOrigin: string;
  receiptUrl: string | null;
  refundedAmountCents: number;
  sessionDate: string;
  sessionPaymentId: string;
  tesCommissionCents: number;
  therapistNetAmountCents: number;
  therapyNameSnapshot: string;
};

export type TherapistReceiptTherapyOption = {
  name: string;
  therapyId: string;
};

export type TherapistReceiptsContract = {
  contractVersion: 1;
  filters: TherapistFinancePeriod & {
    search: string | null;
    status: TherapistFinancialStatus | null;
    therapyId: string | null;
  };
  generatedAt: string;
  items: TherapistReceiptItem[];
  pagination: TherapistFinancePagination;
  therapistProfileId: string;
  therapyOptions: TherapistReceiptTherapyOption[];
};

export type TherapistPayoutItem = {
  blockedReason: string | null;
  expectedTransferAt: string | null;
  failedReason: string | null;
  grossAmountCents: number;
  payoutBatchId: string;
  periodEnd: string;
  periodStart: string;
  reconciliationStatus:
    | "failed"
    | "matched"
    | "needs_reconciliation"
    | "pending"
    | "reversed";
  reconciliationUpdatedAt: string | null;
  refundedAmountCents: number;
  sessionCount: number;
  stripeSourceChargeId: string | null;
  stripeTransferId: string | null;
  tesCommissionCents: number;
  therapistNetAmountCents: number;
  transferredAt: string | null;
  transferStatus: TherapistPayoutStatus;
};

export type TherapistPayoutSummary = {
  blockedCents: number;
  eligibleForPayoutCents: number;
  nextBatchAt: string | null;
  payoutProcessingCents: number;
  waitingConfirmationCents: number;
  waitingSafetyPeriodCents: number;
};

export type TherapistPayoutsContract = {
  contractVersion: 1;
  filters: TherapistFinancePeriod & {
    status: TherapistPayoutStatus | null;
  };
  generatedAt: string;
  items: TherapistPayoutItem[];
  pagination: TherapistFinancePagination;
  summary: TherapistPayoutSummary;
  therapistProfileId: string;
};

export type TherapistConnectAccount = {
  accountExists: boolean;
  chargesEnabled: boolean;
  contractVersion: 1;
  currentlyDue: string[];
  detailsSubmitted: boolean;
  disabledReason: string | null;
  eventuallyDue: string[];
  generatedAt: string;
  lastSyncedAt: string | null;
  maskedAccountId: string | null;
  maskedBankAccountSummary: null;
  onboardingStatus: TherapistConnectOnboardingStatus;
  payoutsEnabled: boolean;
  pendingVerification: string[];
  previousAccountClosed: boolean;
  therapistProfileId: string;
  transferCapabilityStatus: string;
};

export type TherapistFinanceFilters = {
  page: number;
  payoutStatus: TherapistPayoutStatus | null;
  search: string | null;
  status: TherapistFinancialStatus | null;
  therapyId: string | null;
};

export type TherapistFinanceDateRange = {
  end: string;
  key: TherapistFinancePeriodKey;
  start: string;
};

export type FinancialMetricComparisonStatus =
  | "available"
  | "division_by_zero"
  | "insufficient_data"
  | "no_previous_data";

export type FinancialMetricComparison = {
  absoluteDelta: number | null;
  comparisonStatus: FinancialMetricComparisonStatus;
  currentValue: number;
  percentageDelta: number | null;
  previousValue: number | null;
};

export type AdvancedFinancialAvailabilityStatus =
  | "available"
  | "insufficient_data"
  | "unavailable";

export type AdvancedFinancialConfidence = "high" | "low" | "medium";

export type TherapistAdvancedFinancialDashboard = {
  agendaPotential: {
    availableMinutes: number;
    capacityMinutes: number;
    committedMinutes: number;
    confidence: AdvancedFinancialConfidence;
    conservativePotentialCents: number;
    estimatedBookableSlots: number;
    expectedPotentialCents: number;
    maximumPotentialCents: number;
    methodologyVersion: "tes-agenda-potential-v1";
    occupancyRate: number | null;
    reason: string | null;
    status: AdvancedFinancialAvailabilityStatus;
    windowEnd: string;
    windowStart: string;
  };
  benchmark: {
    cohortDescription: string | null;
    methodologyVersion: "tes-financial-benchmark-v1";
    metrics: {
      averageTicketCents: {
        cohortMedian: number | null;
        percentile: number | null;
        therapistValue: number | null;
      };
      occupancyRate: {
        cohortMedian: number | null;
        percentile: number | null;
        therapistValue: number | null;
      };
      returnRate: {
        cohortMedian: number | null;
        percentile: number | null;
        therapistValue: number | null;
      };
    };
    minimumSessions: number;
    minimumTherapists: number;
    sampleSize: number | null;
    status: "available" | "disabled" | "insufficient_sample" | "not_comparable";
  };
  contractVersion: 1;
  financialEvolution: Array<{
    contractedNetCents: number;
    periodEnd: string;
    periodStart: string;
    previousPeriodNetCents: number | null;
    projectedNetCents: number | null;
    realizedNetCents: number;
  }>;
  forecast: {
    confidence: AdvancedFinancialConfidence;
    contractedFutureNetCents: number;
    contractedMonthNetCents: number;
    estimatedOpenAgendaPotentialCents: number;
    methodologyVersion: "tes-financial-forecast-v1";
    realizedNetCents: number;
    reason: string | null;
    status: AdvancedFinancialAvailabilityStatus;
    totalEstimatedPotentialCents: number;
  };
  insights: {
    items: AdvancedFinancialInsight[];
    methodologyVersion: "tes-financial-opportunities-v1";
    status: "available" | "unavailable";
  };
  methodologies: Array<{
    description: string;
    version: string;
  }>;
  opportunities: {
    items: FinancialOpportunity[];
    methodologyVersion: "tes-financial-opportunities-v1";
    primary: FinancialOpportunity;
    status: "available" | "unavailable";
  };
  period: {
    end: string;
    forecastMonthEnd: string;
    forecastMonthStart: string;
    generatedAt: string;
    isPartial: boolean;
    previousEnd: string;
    previousStart: string;
    start: string;
    timezone: string;
  };
  plan: "premium_plus";
  retention: {
    cohorts: Array<{
      censoredPatients: number;
      cohortMonth: string;
      newPatients: number;
      returnRate: number | null;
      returningPatients: number;
      withoutReturnPatients: number;
    }>;
    eligiblePatients: number;
    medianDaysToReturn: number | null;
    methodologyVersion: "tes-retention-v1";
    minimumEligiblePatients: number;
    observationWindowsDays: number[];
    primaryWindowDays: 90;
    returningPatients: number;
    returnRate: number | null;
    status: "available" | "insufficient_data";
    withoutReturnPatients: number;
  };
  revenueByTherapy: Array<{
    averageTicketCents: number | null;
    grossAmountCents: number;
    paidSessionCount: number;
    revenueSharePercent: number | null;
    therapistNetAmountCents: number;
    therapyId: string | null;
    therapyNameSnapshot: string;
    trend: FinancialMetricComparison;
  }>;
  therapistProfileId: string;
};

export type FinancialOpportunityAction =
  | "none"
  | "open_agenda"
  | "review_availability"
  | "review_cancellations"
  | "review_services"
  | "view_patients_without_return";

export type FinancialOpportunity = {
  action: FinancialOpportunityAction;
  code: string;
  confidence: AdvancedFinancialConfidence;
  description: string;
  estimatedImpactCents: number | null;
  evidence: Array<{
    metric: string;
    periodEnd: string;
    periodStart: string;
    value: number | string;
  }>;
  generatedAt: string;
  methodologyVersion: "tes-financial-opportunities-v1";
  title: string;
};

export type AdvancedFinancialInsight = {
  action: FinancialOpportunityAction;
  code: string;
  evidence: FinancialOpportunity["evidence"];
  explanation: string;
  generatedAt: string;
  methodologyVersion: "tes-financial-opportunities-v1";
  title: string;
};

export type TherapistFinancialMetrics = {
  contractVersion: 1;
  financialEvolution: Array<{
    grossAmountCents: number;
    periodEnd: string;
    periodStart: string;
    previousPeriodNetAmountCents: number | null;
    therapistNetAmountCents: number;
  }>;
  metricDefinitionVersion: 1;
  period: {
    end: string;
    generatedAt: string;
    isPartial: boolean;
    previousEnd: string;
    previousStart: string;
    start: string;
    timezone: string;
  };
  plan: "premium" | "premium_plus";
  retention: {
    eligiblePatients: number;
    minimumEligiblePatients: number;
    observationWindowDays: number;
    returningPatients: number;
    returnRate: number | null;
    status: "available" | "insufficient_data";
  };
  revenue: {
    comparison: {
      averageTicket: FinancialMetricComparison;
      grossPaid: FinancialMetricComparison;
      paidSessions: FinancialMetricComparison;
      therapistNet: FinancialMetricComparison;
    };
    grossAverageTicketCents: number | null;
    grossPaidCents: number;
    netAverageTicketCents: number | null;
    paidSessionCount: number;
    therapistNetCents: number;
  };
  revenueByTherapy: Array<{
    averageTicketCents: number | null;
    grossAmountCents: number;
    paidSessionCount: number;
    therapistNetAmountCents: number;
    therapyId: string | null;
    therapyNameSnapshot: string;
  }>;
  sessions: {
    cancellationRate: number | null;
    cancelledCount: number;
    completedCount: number;
    eligibleScheduledCount: number;
    rescheduleRate: number | null;
    rescheduledCount: number;
  };
  therapistProfileId: string;
};

export type TherapistFinanceConnectAction =
  | "create_or_continue"
  | "login"
  | "sync";

export type TherapistFinanceAnalyticsAccess =
  | {
      metrics: TherapistFinancialMetrics;
      status: "available";
    }
  | {
      metrics: null;
      requiredPlan: "Premium";
      status: "locked";
    };

export type TherapistFinanceAdvancedAccess =
  | {
      dashboard: TherapistAdvancedFinancialDashboard;
      status: "available";
    }
  | {
      dashboard: null;
      requiredPlan: "Premium Plus";
      status: "locked";
    };

export type TherapistFinancePageData = {
  account: TherapistConnectAccount;
  advanced: TherapistFinanceAdvancedAccess;
  analytics: TherapistFinanceAnalyticsAccess;
  overview: TherapistFinancialOverview;
  payouts: TherapistPayoutsContract;
  receipts: TherapistReceiptsContract;
};
