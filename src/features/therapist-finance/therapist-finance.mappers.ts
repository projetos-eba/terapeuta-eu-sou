import { TherapistFinanceError } from "./therapist-finance.errors";
import type {
  AdvancedFinancialConfidence,
  AdvancedFinancialInsight,
  AdvancedFinancialAvailabilityStatus,
  FinancialOpportunity,
  FinancialOpportunityAction,
  FinancialMetricComparison,
  FinancialMetricComparisonStatus,
  TherapistAdvancedFinancialDashboard,
  TherapistConnectAccount,
  TherapistConnectOnboardingStatus,
  TherapistFinancialOverview,
  TherapistFinancialStatus,
  TherapistFinancePagination,
  TherapistFinancialMetrics,
  TherapistPayoutItem,
  TherapistPayoutStatus,
  TherapistPayoutSummary,
  TherapistPayoutsContract,
  TherapistReceiptItem,
  TherapistReceiptStatus,
  TherapistReceiptTherapyOption,
  TherapistReceiptsContract,
} from "./therapist-finance.types";

const financialStatuses = new Set<TherapistFinancialStatus>([
  "canceled",
  "disputed",
  "failed",
  "paid",
  "partially_refunded",
  "pending",
  "processing",
  "refunded",
]);

const payoutStatuses = new Set<TherapistPayoutStatus>([
  "bank_pending",
  "batched",
  "blocked",
  "eligible",
  "failed",
  "paid",
  "reversed",
  "transferred",
  "transfer_pending",
  "waiting_confirmation",
  "waiting_safety_period",
  "waiting_settlement",
]);

const receiptStatuses = new Set<TherapistReceiptStatus>([
  "bank_pending",
  "blocked",
  "canceled",
  "disputed",
  "eligible",
  "failed",
  "paid",
  "payout_processing",
  "receivable",
  "refunded",
  "reversed",
  "waiting_confirmation",
  "waiting_safety_period",
  "waiting_settlement",
]);

const payoutReconciliationStatuses = new Set<
  TherapistPayoutItem["reconciliationStatus"]
>(["failed", "matched", "needs_reconciliation", "paid", "pending", "reversed"]);

const connectStatuses = new Set<TherapistConnectOnboardingStatus>([
  "account_created",
  "disabled",
  "not_started",
  "onboarding_started",
  "ready",
  "requirements_due",
  "restricted",
]);

const comparisonStatuses = new Set<FinancialMetricComparisonStatus>([
  "available",
  "division_by_zero",
  "insufficient_data",
  "no_previous_data",
]);

const advancedAvailabilityStatuses =
  new Set<AdvancedFinancialAvailabilityStatus>([
    "available",
    "insufficient_data",
    "unavailable",
  ]);

const advancedConfidenceLevels = new Set<AdvancedFinancialConfidence>([
  "high",
  "low",
  "medium",
]);

const financialOpportunityActions = new Set<FinancialOpportunityAction>([
  "none",
  "open_agenda",
  "review_availability",
  "review_cancellations",
  "review_services",
  "view_patients_without_return",
]);

export function mapTherapistFinancialOverview(
  input: unknown,
): TherapistFinancialOverview {
  try {
    const value = record(input);

    return {
      blockedCents: integer(value.blockedCents),
      contractVersion: literalTwo(value.contractVersion),
      disputedCents: integer(value.disputedCents),
      eligibleForPayoutCents: integer(value.eligibleForPayoutCents),
      generatedAt: dateTime(value.generatedAt),
      grossPaidCents: integer(value.grossPaidCents),
      payoutProcessingCents: integer(value.payoutProcessingCents),
      processingCents: integer(value.processingCents),
      receivedCents: integer(value.receivedCents),
      periodEnd: dateString(value.periodEnd),
      periodStart: dateString(value.periodStart),
      plan: plan(value.plan),
      refundedToCustomersCents: integer(value.refundedToCustomersCents),
      tesCommissionCents: integer(value.tesCommissionCents),
      therapistNetCents: integer(value.therapistNetCents),
      therapistProfileId: nonEmptyString(value.therapistProfileId),
      timezone: nonEmptyString(value.timezone),
      transferredCents: integer(value.transferredCents),
      waitingConfirmationCents: integer(value.waitingConfirmationCents),
      waitingSafetyPeriodCents: integer(value.waitingSafetyPeriodCents),
      waitingSettlementCents: integer(value.waitingSettlementCents),
    };
  } catch (error) {
    if (error instanceof TherapistFinanceError) throw error;
    throw new TherapistFinanceError("invalid_contract");
  }
}

export function mapTherapistReceiptsContract(
  input: unknown,
): TherapistReceiptsContract {
  try {
    const value = record(input);
    const filters = record(value.filters);

    return {
      contractVersion: literalTwo(value.contractVersion),
      filters: {
        periodEnd: dateString(filters.periodEnd),
        periodStart: dateString(filters.periodStart),
        search: nullableString(filters.search),
        status: nullableReceiptStatus(filters.status),
        therapyId: nullableString(filters.therapyId),
        timezone: nonEmptyString(filters.timezone),
      },
      generatedAt: dateTime(value.generatedAt),
      items: array(value.items).map(receiptItem),
      monthlyTrend: array(value.monthlyTrend).map(monthlyTrendPoint),
      pagination: pagination(value.pagination),
      statusDistribution: array(value.statusDistribution).map(
        statusDistributionItem,
      ),
      summary: receiptSummary(value.summary),
      therapistProfileId: nonEmptyString(value.therapistProfileId),
      therapyOptions: array(value.therapyOptions).map(therapyOption),
    };
  } catch (error) {
    if (error instanceof TherapistFinanceError) throw error;
    throw new TherapistFinanceError("invalid_contract");
  }
}

export function mapTherapistPayoutsContract(
  input: unknown,
): TherapistPayoutsContract {
  try {
    const value = record(input);
    const filters = record(value.filters);

    return {
      contractVersion: literalTwo(value.contractVersion),
      filters: {
        periodEnd: dateString(filters.periodEnd),
        periodStart: dateString(filters.periodStart),
        status: nullablePayoutStatus(filters.status),
        timezone: nonEmptyString(filters.timezone),
      },
      generatedAt: dateTime(value.generatedAt),
      items: array(value.items).map(payoutItem),
      pagination: pagination(value.pagination),
      summary: payoutSummary(value.summary),
      therapistProfileId: nonEmptyString(value.therapistProfileId),
    };
  } catch (error) {
    if (error instanceof TherapistFinanceError) throw error;
    throw new TherapistFinanceError("invalid_contract");
  }
}

export function mapTherapistConnectAccount(
  input: unknown,
): TherapistConnectAccount {
  try {
    const value = record(input);

    return {
      accountExists: boolean(value.accountExists),
      chargesEnabled: boolean(value.chargesEnabled),
      contractVersion: literalOne(value.contractVersion),
      currentlyDue: array(value.currentlyDue).map(nonEmptyString),
      detailsSubmitted: boolean(value.detailsSubmitted),
      disabledReason: nullableString(value.disabledReason),
      eventuallyDue: array(value.eventuallyDue).map(nonEmptyString),
      generatedAt: dateTime(value.generatedAt),
      lastSyncedAt: nullableDateTime(value.lastSyncedAt),
      maskedAccountId: nullableString(value.maskedAccountId),
      maskedBankAccountSummary: nullValue(value.maskedBankAccountSummary),
      onboardingStatus: connectStatus(value.onboardingStatus),
      payoutsEnabled: boolean(value.payoutsEnabled),
      pendingVerification: array(value.pendingVerification).map(nonEmptyString),
      previousAccountClosed: boolean(value.previousAccountClosed),
      therapistProfileId: nonEmptyString(value.therapistProfileId),
      transferCapabilityStatus: nonEmptyString(value.transferCapabilityStatus),
    };
  } catch (error) {
    if (error instanceof TherapistFinanceError) throw error;
    throw new TherapistFinanceError("invalid_contract");
  }
}

export function mapTherapistFinancialMetrics(
  input: unknown,
): TherapistFinancialMetrics {
  try {
    const value = record(input);
    const period = record(value.period);
    const revenue = record(value.revenue);
    const comparison = record(revenue.comparison);
    const sessions = record(value.sessions);
    const retention = record(value.retention);

    return {
      contractVersion: literalOne(value.contractVersion),
      financialEvolution: array(value.financialEvolution).map(
        financialEvolutionPoint,
      ),
      metricDefinitionVersion: literalOne(value.metricDefinitionVersion),
      period: {
        end: dateString(period.end),
        generatedAt: dateTime(period.generatedAt),
        isPartial: boolean(period.isPartial),
        previousEnd: dateString(period.previousEnd),
        previousStart: dateString(period.previousStart),
        start: dateString(period.start),
        timezone: nonEmptyString(period.timezone),
      },
      plan: paidPlan(value.plan),
      retention: {
        eligiblePatients: nonNegativeInteger(retention.eligiblePatients),
        minimumEligiblePatients: nonNegativeInteger(
          retention.minimumEligiblePatients,
        ),
        observationWindowDays: positiveInteger(retention.observationWindowDays),
        returningPatients: nonNegativeInteger(retention.returningPatients),
        returnRate: nullableNumber(retention.returnRate),
        status: retentionStatus(retention.status),
      },
      revenue: {
        comparison: {
          averageTicket: metricComparison(comparison.averageTicket),
          grossPaid: metricComparison(comparison.grossPaid),
          paidSessions: metricComparison(comparison.paidSessions),
          therapistNet: metricComparison(comparison.therapistNet),
        },
        grossAverageTicketCents: nullableInteger(
          revenue.grossAverageTicketCents,
        ),
        grossPaidCents: nonNegativeInteger(revenue.grossPaidCents),
        netAverageTicketCents: nullableInteger(revenue.netAverageTicketCents),
        paidSessionCount: nonNegativeInteger(revenue.paidSessionCount),
        therapistNetCents: integer(revenue.therapistNetCents),
      },
      revenueByTherapy: array(value.revenueByTherapy).map(revenueByTherapy),
      sessions: {
        cancellationRate: nullableNumber(sessions.cancellationRate),
        cancelledCount: nonNegativeInteger(sessions.cancelledCount),
        completedCount: nonNegativeInteger(sessions.completedCount),
        eligibleScheduledCount: nonNegativeInteger(
          sessions.eligibleScheduledCount,
        ),
        rescheduleRate: nullableNumber(sessions.rescheduleRate),
        rescheduledCount: nonNegativeInteger(sessions.rescheduledCount),
      },
      therapistProfileId: nonEmptyString(value.therapistProfileId),
    };
  } catch (error) {
    if (error instanceof TherapistFinanceError) throw error;
    throw new TherapistFinanceError("invalid_contract");
  }
}

export function mapTherapistAdvancedFinancialDashboard(
  input: unknown,
): TherapistAdvancedFinancialDashboard {
  try {
    const value = record(input);
    const period = record(value.period);
    const forecast = record(value.forecast);
    const agendaPotential = record(value.agendaPotential);
    const opportunities = record(value.opportunities);
    const retention = record(value.retention);
    const benchmark = record(value.benchmark);
    const insights = record(value.insights);

    return {
      agendaPotential: {
        availableMinutes: nonNegativeInteger(agendaPotential.availableMinutes),
        capacityMinutes: nonNegativeInteger(agendaPotential.capacityMinutes),
        committedMinutes: nonNegativeInteger(agendaPotential.committedMinutes),
        confidence: advancedConfidence(agendaPotential.confidence),
        conservativePotentialCents: nonNegativeInteger(
          agendaPotential.conservativePotentialCents,
        ),
        estimatedBookableSlots: nonNegativeInteger(
          agendaPotential.estimatedBookableSlots,
        ),
        expectedPotentialCents: nonNegativeInteger(
          agendaPotential.expectedPotentialCents,
        ),
        maximumPotentialCents: nonNegativeInteger(
          agendaPotential.maximumPotentialCents,
        ),
        methodologyVersion: literalString(
          agendaPotential.methodologyVersion,
          "tes-agenda-potential-v1",
        ),
        occupancyRate: nullableNumber(agendaPotential.occupancyRate),
        reason: nullableString(agendaPotential.reason),
        status: advancedAvailabilityStatus(agendaPotential.status),
        windowEnd: dateString(agendaPotential.windowEnd),
        windowStart: dateString(agendaPotential.windowStart),
      },
      benchmark: benchmarkContract(benchmark),
      contractVersion: literalOne(value.contractVersion),
      financialEvolution: array(value.financialEvolution).map(
        advancedEvolutionPoint,
      ),
      forecast: {
        confidence: advancedConfidence(forecast.confidence),
        contractedFutureNetCents: nonNegativeInteger(
          forecast.contractedFutureNetCents,
        ),
        contractedMonthNetCents: nonNegativeInteger(
          forecast.contractedMonthNetCents,
        ),
        estimatedOpenAgendaPotentialCents: nonNegativeInteger(
          forecast.estimatedOpenAgendaPotentialCents,
        ),
        methodologyVersion: literalString(
          forecast.methodologyVersion,
          "tes-financial-forecast-v1",
        ),
        realizedNetCents: integer(forecast.realizedNetCents),
        reason: nullableString(forecast.reason),
        status: advancedAvailabilityStatus(forecast.status),
        totalEstimatedPotentialCents: nonNegativeInteger(
          forecast.totalEstimatedPotentialCents,
        ),
      },
      insights: {
        items: array(insights.items).map(advancedFinancialInsight),
        methodologyVersion: literalString(
          insights.methodologyVersion,
          "tes-financial-opportunities-v1",
        ),
        status: availabilityLooseStatus(insights.status),
      },
      methodologies: array(value.methodologies).map(methodology),
      opportunities: {
        items: array(opportunities.items).map(financialOpportunity),
        methodologyVersion: literalString(
          opportunities.methodologyVersion,
          "tes-financial-opportunities-v1",
        ),
        primary: financialOpportunity(opportunities.primary),
        status: availabilityLooseStatus(opportunities.status),
      },
      period: {
        end: dateString(period.end),
        forecastMonthEnd: dateString(period.forecastMonthEnd),
        forecastMonthStart: dateString(period.forecastMonthStart),
        generatedAt: dateTime(period.generatedAt),
        isPartial: boolean(period.isPartial),
        previousEnd: dateString(period.previousEnd),
        previousStart: dateString(period.previousStart),
        start: dateString(period.start),
        timezone: nonEmptyString(period.timezone),
      },
      plan: premiumPlusPlan(value.plan),
      retention: {
        cohorts: array(retention.cohorts).map(retentionCohort),
        eligiblePatients: nonNegativeInteger(retention.eligiblePatients),
        medianDaysToReturn: nullableNumber(retention.medianDaysToReturn),
        methodologyVersion: literalString(
          retention.methodologyVersion,
          "tes-retention-v1",
        ),
        minimumEligiblePatients: nonNegativeInteger(
          retention.minimumEligiblePatients,
        ),
        observationWindowsDays: array(retention.observationWindowsDays).map(
          positiveInteger,
        ),
        primaryWindowDays: literalNumber(retention.primaryWindowDays, 90),
        returningPatients: nonNegativeInteger(retention.returningPatients),
        returnRate: nullableNumber(retention.returnRate),
        status: retentionStatus(retention.status),
        withoutReturnPatients: nonNegativeInteger(
          retention.withoutReturnPatients,
        ),
      },
      revenueByTherapy: array(value.revenueByTherapy).map(
        advancedRevenueByTherapy,
      ),
      therapistProfileId: nonEmptyString(value.therapistProfileId),
    };
  } catch (error) {
    if (error instanceof TherapistFinanceError) throw error;
    throw new TherapistFinanceError("invalid_contract");
  }
}

function receiptItem(input: unknown): TherapistReceiptItem {
  const value = record(input);

  return {
    bookingId: nonEmptyString(value.bookingId),
    createdAt: dateTime(value.createdAt),
    disputeStatus: nullableString(value.disputeStatus),
    financialStatus: financialStatus(value.financialStatus),
    grossAmountCents: nonNegativeInteger(value.grossAmountCents),
    patientDisplayName: nonEmptyString(value.patientDisplayName),
    paymentMethodType: nullableString(value.paymentMethodType),
    paymentOrigin: nonEmptyString(value.paymentOrigin),
    receiptUrl: nullableString(value.receiptUrl),
    receiptStatus: receiptStatus(value.receiptStatus),
    receivedAt: nullableDateTime(value.receivedAt),
    refundedAmountCents: nonNegativeInteger(value.refundedAmountCents),
    sessionDate: dateTime(value.sessionDate),
    sessionPaymentId: nonEmptyString(value.sessionPaymentId),
    tesCommissionCents: nonNegativeInteger(value.tesCommissionCents),
    therapistNetAmountCents: integer(value.therapistNetAmountCents),
    therapyNameSnapshot: nonEmptyString(value.therapyNameSnapshot),
  };
}

function payoutItem(input: unknown): TherapistPayoutItem {
  const value = record(input);

  return {
    blockedReason: nullableString(value.blockedReason),
    expectedTransferAt: nullableDateTime(value.expectedTransferAt),
    failedReason: nullableString(value.failedReason),
    grossAmountCents: nonNegativeInteger(value.grossAmountCents),
    payoutBatchId: nonEmptyString(value.payoutBatchId),
    periodEnd: dateString(value.periodEnd),
    periodStart: dateString(value.periodStart),
    reconciliationStatus: payoutReconciliationStatus(
      value.reconciliationStatus,
    ),
    reconciliationUpdatedAt: nullableDateTime(value.reconciliationUpdatedAt),
    refundedAmountCents: nonNegativeInteger(value.refundedAmountCents),
    sessionCount: nonNegativeInteger(value.sessionCount),
    stripeSourceChargeId: nullableString(value.stripeSourceChargeId),
    stripeTransferId: nullableString(value.stripeTransferId),
    tesCommissionCents: nonNegativeInteger(value.tesCommissionCents),
    therapistNetAmountCents: integer(value.therapistNetAmountCents),
    transferredAt: nullableDateTime(value.transferredAt),
    transferStatus: payoutStatus(value.transferStatus),
  };
}

function payoutSummary(input: unknown): TherapistPayoutSummary {
  const value = record(input);

  return {
    blockedReasonCodes: payoutBlockedReasonCodes(value.blockedReasonCodes),
    blockedCents: nonNegativeInteger(value.blockedCents),
    eligibleForPayoutCents: nonNegativeInteger(value.eligibleForPayoutCents),
    nextBatchAt: nullableDateTime(value.nextBatchAt),
    payoutProcessingCents: nonNegativeInteger(value.payoutProcessingCents),
    waitingConfirmationCents: nonNegativeInteger(
      value.waitingConfirmationCents,
    ),
    waitingSafetyPeriodCents: nonNegativeInteger(
      value.waitingSafetyPeriodCents,
    ),
    waitingSettlementCents: nonNegativeInteger(value.waitingSettlementCents),
  };
}

function receiptSummary(input: unknown): TherapistReceiptsContract["summary"] {
  const value = record(input);
  return {
    disputedCents: nonNegativeInteger(value.disputedCents),
    processingCents: nonNegativeInteger(value.processingCents),
    receivedCents: nonNegativeInteger(value.receivedCents),
    refundedCents: nonNegativeInteger(value.refundedCents),
  };
}

function monthlyTrendPoint(
  input: unknown,
): TherapistReceiptsContract["monthlyTrend"][number] {
  const value = record(input);
  return {
    month: nonEmptyString(value.month),
    processingCents: nonNegativeInteger(value.processingCents),
    receivedCents: nonNegativeInteger(value.receivedCents),
  };
}

function statusDistributionItem(
  input: unknown,
): TherapistReceiptsContract["statusDistribution"][number] {
  const value = record(input);
  return {
    amountCents: nonNegativeInteger(value.amountCents),
    itemCount: nonNegativeInteger(value.itemCount),
    status: receiptStatus(value.status),
  };
}

function payoutBlockedReasonCodes(
  input: unknown,
): TherapistPayoutSummary["blockedReasonCodes"] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (item): item is TherapistPayoutSummary["blockedReasonCodes"][number] =>
      item === "account" ||
      item === "review" ||
      item === "refund" ||
      item === "other",
  );
}

function therapyOption(input: unknown): TherapistReceiptTherapyOption {
  const value = record(input);

  return {
    name: nonEmptyString(value.name),
    therapyId: nonEmptyString(value.therapyId),
  };
}

function metricComparison(input: unknown): FinancialMetricComparison {
  const value = record(input);

  return {
    absoluteDelta: nullableNumber(value.absoluteDelta),
    comparisonStatus: comparisonStatus(value.comparisonStatus),
    currentValue: number(value.currentValue),
    percentageDelta: nullableNumber(value.percentageDelta),
    previousValue: nullableNumber(value.previousValue),
  };
}

function revenueByTherapy(
  input: unknown,
): TherapistFinancialMetrics["revenueByTherapy"][number] {
  const value = record(input);

  return {
    averageTicketCents: nullableInteger(value.averageTicketCents),
    grossAmountCents: nonNegativeInteger(value.grossAmountCents),
    paidSessionCount: nonNegativeInteger(value.paidSessionCount),
    therapistNetAmountCents: integer(value.therapistNetAmountCents),
    therapyId: nullableString(value.therapyId),
    therapyNameSnapshot: nonEmptyString(value.therapyNameSnapshot),
  };
}

function financialEvolutionPoint(
  input: unknown,
): TherapistFinancialMetrics["financialEvolution"][number] {
  const value = record(input);

  return {
    grossAmountCents: nonNegativeInteger(value.grossAmountCents),
    periodEnd: dateString(value.periodEnd),
    periodStart: dateString(value.periodStart),
    previousPeriodNetAmountCents: nullableInteger(
      value.previousPeriodNetAmountCents,
    ),
    therapistNetAmountCents: integer(value.therapistNetAmountCents),
  };
}

function advancedEvolutionPoint(
  input: unknown,
): TherapistAdvancedFinancialDashboard["financialEvolution"][number] {
  const value = record(input);

  return {
    contractedNetCents: nonNegativeInteger(value.contractedNetCents),
    periodEnd: dateString(value.periodEnd),
    periodStart: dateString(value.periodStart),
    previousPeriodNetCents: nullableInteger(value.previousPeriodNetCents),
    projectedNetCents: nullableInteger(value.projectedNetCents),
    realizedNetCents: integer(value.realizedNetCents),
  };
}

function advancedRevenueByTherapy(
  input: unknown,
): TherapistAdvancedFinancialDashboard["revenueByTherapy"][number] {
  const value = record(input);

  return {
    averageTicketCents: nullableInteger(value.averageTicketCents),
    grossAmountCents: nonNegativeInteger(value.grossAmountCents),
    paidSessionCount: nonNegativeInteger(value.paidSessionCount),
    revenueSharePercent: nullableNumber(value.revenueSharePercent),
    therapistNetAmountCents: integer(value.therapistNetAmountCents),
    therapyId: nullableString(value.therapyId),
    therapyNameSnapshot: nonEmptyString(value.therapyNameSnapshot),
    trend: metricComparison(value.trend),
  };
}

function financialOpportunity(input: unknown): FinancialOpportunity {
  const value = record(input);

  return {
    action: financialOpportunityAction(value.action),
    code: nonEmptyString(value.code),
    confidence: advancedConfidence(value.confidence),
    description: nonEmptyString(value.description),
    estimatedImpactCents: nullableInteger(value.estimatedImpactCents),
    evidence: array(value.evidence).map(opportunityEvidence),
    generatedAt: dateTime(value.generatedAt),
    methodologyVersion: literalString(
      value.methodologyVersion,
      "tes-financial-opportunities-v1",
    ),
    title: nonEmptyString(value.title),
  };
}

function advancedFinancialInsight(input: unknown): AdvancedFinancialInsight {
  const value = record(input);

  return {
    action: financialOpportunityAction(value.action),
    code: nonEmptyString(value.code),
    evidence: array(value.evidence).map(opportunityEvidence),
    explanation: nonEmptyString(value.explanation),
    generatedAt: dateTime(value.generatedAt),
    methodologyVersion: literalString(
      value.methodologyVersion,
      "tes-financial-opportunities-v1",
    ),
    title: nonEmptyString(value.title),
  };
}

function opportunityEvidence(
  input: unknown,
): FinancialOpportunity["evidence"][number] {
  const value = record(input);
  const evidenceValue = value.value;

  if (typeof evidenceValue !== "number" && typeof evidenceValue !== "string") {
    throw new Error("Invalid opportunity evidence value.");
  }

  return {
    metric: nonEmptyString(value.metric),
    periodEnd: dateString(value.periodEnd),
    periodStart: dateString(value.periodStart),
    value: evidenceValue,
  };
}

function retentionCohort(
  input: unknown,
): TherapistAdvancedFinancialDashboard["retention"]["cohorts"][number] {
  const value = record(input);

  return {
    censoredPatients: nonNegativeInteger(value.censoredPatients),
    cohortMonth: dateString(value.cohortMonth),
    newPatients: nonNegativeInteger(value.newPatients),
    returnRate: nullableNumber(value.returnRate),
    returningPatients: nonNegativeInteger(value.returningPatients),
    withoutReturnPatients: nonNegativeInteger(value.withoutReturnPatients),
  };
}

function benchmarkContract(
  input: unknown,
): TherapistAdvancedFinancialDashboard["benchmark"] {
  const value = record(input);
  const metrics = record(value.metrics);

  return {
    cohortDescription: nullableString(value.cohortDescription),
    methodologyVersion: literalString(
      value.methodologyVersion,
      "tes-financial-benchmark-v1",
    ),
    metrics: {
      averageTicketCents: benchmarkMetric(record(metrics.averageTicketCents)),
      occupancyRate: benchmarkMetric(record(metrics.occupancyRate)),
      returnRate: benchmarkMetric(record(metrics.returnRate)),
    },
    minimumSessions: nonNegativeInteger(value.minimumSessions),
    minimumTherapists: nonNegativeInteger(value.minimumTherapists),
    sampleSize: nullableInteger(value.sampleSize),
    status: benchmarkStatus(value.status),
  };
}

function benchmarkMetric(input: Record<string, unknown>) {
  return {
    cohortMedian: nullableNumber(input.cohortMedian),
    percentile: nullableNumber(input.percentile),
    therapistValue: nullableNumber(input.therapistValue),
  };
}

function methodology(input: unknown) {
  const value = record(input);

  return {
    description: nonEmptyString(value.description),
    version: nonEmptyString(value.version),
  };
}

function pagination(input: unknown): TherapistFinancePagination {
  const value = record(input);

  return {
    hasNextPage: boolean(value.hasNextPage),
    page: positiveInteger(value.page),
    pageSize: positiveInteger(value.pageSize),
    totalCount: nonNegativeInteger(value.totalCount),
    totalPages: nonNegativeInteger(value.totalPages),
  };
}

function financialStatus(value: unknown): TherapistFinancialStatus {
  if (
    typeof value === "string" &&
    financialStatuses.has(value as TherapistFinancialStatus)
  ) {
    return value as TherapistFinancialStatus;
  }
  throw new Error("Invalid financial status.");
}

function nullableFinancialStatus(value: unknown) {
  if (value === null || value === undefined) return null;
  return financialStatus(value);
}

function receiptStatus(value: unknown): TherapistReceiptStatus {
  if (
    typeof value === "string" &&
    receiptStatuses.has(value as TherapistReceiptStatus)
  ) {
    return value as TherapistReceiptStatus;
  }
  throw new Error("Invalid receipt status.");
}

function nullableReceiptStatus(value: unknown) {
  if (value === null || value === undefined) return null;
  return receiptStatus(value);
}

function payoutStatus(value: unknown): TherapistPayoutStatus {
  if (
    typeof value === "string" &&
    payoutStatuses.has(value as TherapistPayoutStatus)
  ) {
    return value as TherapistPayoutStatus;
  }
  throw new Error("Invalid payout status.");
}

function payoutReconciliationStatus(
  value: unknown,
): TherapistPayoutItem["reconciliationStatus"] {
  if (
    typeof value === "string" &&
    payoutReconciliationStatuses.has(
      value as TherapistPayoutItem["reconciliationStatus"],
    )
  ) {
    return value as TherapistPayoutItem["reconciliationStatus"];
  }
  throw new Error("Invalid payout reconciliation status.");
}

function nullablePayoutStatus(value: unknown) {
  if (value === null || value === undefined) return null;
  return payoutStatus(value);
}

function connectStatus(value: unknown): TherapistConnectOnboardingStatus {
  if (
    typeof value === "string" &&
    connectStatuses.has(value as TherapistConnectOnboardingStatus)
  ) {
    return value as TherapistConnectOnboardingStatus;
  }
  throw new Error("Invalid Connect status.");
}

function comparisonStatus(value: unknown): FinancialMetricComparisonStatus {
  if (
    typeof value === "string" &&
    comparisonStatuses.has(value as FinancialMetricComparisonStatus)
  ) {
    return value as FinancialMetricComparisonStatus;
  }
  throw new Error("Invalid comparison status.");
}

function advancedAvailabilityStatus(
  value: unknown,
): AdvancedFinancialAvailabilityStatus {
  if (
    typeof value === "string" &&
    advancedAvailabilityStatuses.has(
      value as AdvancedFinancialAvailabilityStatus,
    )
  ) {
    return value as AdvancedFinancialAvailabilityStatus;
  }
  throw new Error("Invalid advanced availability status.");
}

function availabilityLooseStatus(value: unknown): "available" | "unavailable" {
  if (value === "available" || value === "unavailable") return value;
  throw new Error("Invalid availability status.");
}

function advancedConfidence(value: unknown): AdvancedFinancialConfidence {
  if (
    typeof value === "string" &&
    advancedConfidenceLevels.has(value as AdvancedFinancialConfidence)
  ) {
    return value as AdvancedFinancialConfidence;
  }
  throw new Error("Invalid confidence.");
}

function financialOpportunityAction(
  value: unknown,
): FinancialOpportunityAction {
  if (
    typeof value === "string" &&
    financialOpportunityActions.has(value as FinancialOpportunityAction)
  ) {
    return value as FinancialOpportunityAction;
  }
  throw new Error("Invalid financial opportunity action.");
}

function benchmarkStatus(
  value: unknown,
): TherapistAdvancedFinancialDashboard["benchmark"]["status"] {
  if (
    value === "available" ||
    value === "disabled" ||
    value === "insufficient_sample" ||
    value === "not_comparable"
  ) {
    return value;
  }
  throw new Error("Invalid benchmark status.");
}

function retentionStatus(value: unknown): "available" | "insufficient_data" {
  if (value === "available" || value === "insufficient_data") return value;
  throw new Error("Invalid retention status.");
}

function plan(value: unknown): "free" | "premium" | "premium_plus" {
  if (value === "free" || value === "premium" || value === "premium_plus") {
    return value;
  }
  throw new Error("Invalid plan.");
}

function paidPlan(value: unknown): "premium" | "premium_plus" {
  if (value === "premium" || value === "premium_plus") return value;
  throw new Error("Invalid paid plan.");
}

function premiumPlusPlan(value: unknown): "premium_plus" {
  if (value === "premium_plus") return value;
  throw new Error("Invalid Premium Plus plan.");
}

function record(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Expected record.");
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new Error("Expected array.");
}

function literalOne(value: unknown): 1 {
  if (value === 1) return 1;
  throw new Error("Invalid contract version.");
}

function literalTwo(value: unknown): 2 {
  if (value === 2) return 2;
  throw new Error("Invalid contract version.");
}

function literalNumber<TExpected extends number>(
  value: unknown,
  expected: TExpected,
): TExpected {
  if (value === expected) return expected;
  throw new Error("Invalid numeric literal.");
}

function literalString<TExpected extends string>(
  value: unknown,
  expected: TExpected,
): TExpected {
  if (value === expected) return expected;
  throw new Error("Invalid string literal.");
}

function nonEmptyString(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new Error("Expected non-empty string.");
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  throw new Error("Expected nullable string.");
}

function boolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new Error("Expected boolean.");
}

function integer(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  throw new Error("Expected integer.");
}

function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return integer(value);
}

function number(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error("Expected number.");
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return number(value);
}

function nonNegativeInteger(value: unknown): number {
  const parsed = integer(value);
  if (parsed >= 0) return parsed;
  throw new Error("Expected non-negative integer.");
}

function positiveInteger(value: unknown): number {
  const parsed = integer(value);
  if (parsed > 0) return parsed;
  throw new Error("Expected positive integer.");
}

function dateTime(value: unknown): string {
  const parsed = nonEmptyString(value);
  if (Number.isNaN(Date.parse(parsed))) {
    throw new Error("Expected ISO date time.");
  }
  return parsed;
}

function nullableDateTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return dateTime(value);
}

function dateString(value: unknown): string {
  const parsed = nonEmptyString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
    throw new Error("Expected ISO date.");
  }
  return parsed;
}

function nullValue(value: unknown): null {
  if (value === null) return null;
  throw new Error("Expected null.");
}
