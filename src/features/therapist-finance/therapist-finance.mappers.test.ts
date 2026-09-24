import { describe, expect, it } from "vitest";

import { TherapistFinanceError } from "./therapist-finance.errors";
import {
  mapTherapistAdvancedFinancialDashboard,
  mapTherapistConnectAccount,
  mapTherapistFinancialOverview,
  mapTherapistFinancialMetrics,
  mapTherapistPayoutsContract,
  mapTherapistReceiptsContract,
} from "./therapist-finance.mappers";

describe("therapist finance mappers", () => {
  it("maps the financial overview without recalculating cents in the browser", () => {
    const overview = mapTherapistFinancialOverview({
      blockedCents: 0,
      contractVersion: 3,
      disputedCents: 7000,
      eligibleForPayoutCents: 12000,
      generatedAt: "2026-07-28T12:00:00.000Z",
      grossPaidCents: 22000,
      payoutProcessingCents: 0,
      processingCents: 12000,
      receivedCents: 8000,
      periodEnd: "2026-07-28",
      periodStart: "2026-06-29",
      plan: "free",
      refundedToCustomersCents: 1000,
      tesCommissionCents: 4400,
      therapistNetCents: 16600,
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      timezone: "America/Sao_Paulo",
      transferredCents: 8000,
      waitingConfirmationCents: 0,
      waitingSafetyPeriodCents: 4000,
      waitingSettlementCents: 0,
    });

    expect(overview.therapistNetCents).toBe(16600);
    expect(Number.isInteger(overview.grossPaidCents)).toBe(true);
    expect(overview.plan).toBe("free");
  });

  it("rejects invalid financial contracts instead of falling back silently", () => {
    expect(() =>
      mapTherapistFinancialOverview({
        contractVersion: 1,
        grossPaidCents: 100.5,
      }),
    ).toThrow(TherapistFinanceError);
  });

  it("maps F2 financial metrics with comparisons and insufficient-data states", () => {
    const metrics = mapTherapistFinancialMetrics({
      contractVersion: 2,
      financialEvolution: [
        {
          grossAmountCents: 10000,
          periodEnd: "2026-07-05",
          periodStart: "2026-06-29",
          previousPeriodNetAmountCents: null,
          therapistNetAmountCents: 7000,
        },
      ],
      metricDefinitionVersion: 2,
      period: {
        end: "2026-07-28",
        generatedAt: "2026-07-28T12:00:00.000Z",
        isPartial: true,
        previousEnd: "2026-06-28",
        previousStart: "2026-05-30",
        start: "2026-06-29",
        timezone: "America/Sao_Paulo",
      },
      plan: "premium_plus",
      retention: {
        eligiblePatients: 4,
        minimumEligiblePatients: 10,
        observationWindowDays: 90,
        returningPatients: 2,
        returnRate: null,
        status: "insufficient_data",
      },
      revenue: {
        comparison: {
          averageTicket: {
            absoluteDelta: null,
            comparisonStatus: "no_previous_data",
            currentValue: 7000,
            percentageDelta: null,
            previousValue: null,
          },
          grossPaid: {
            absoluteDelta: 3000,
            comparisonStatus: "available",
            currentValue: 10000,
            percentageDelta: 42.9,
            previousValue: 7000,
          },
          paidSessions: {
            absoluteDelta: 1,
            comparisonStatus: "division_by_zero",
            currentValue: 1,
            percentageDelta: null,
            previousValue: 0,
          },
          therapistNet: {
            absoluteDelta: null,
            comparisonStatus: "insufficient_data",
            currentValue: 0,
            percentageDelta: null,
            previousValue: null,
          },
        },
        grossAverageTicketCents: 10000,
        grossPaidCents: 10000,
        netAverageTicketCents: 7000,
        paidSessionCount: 1,
        therapistNetCents: 7000,
      },
      revenueByTherapy: [
        {
          averageTicketCents: 10000,
          grossAmountCents: 10000,
          paidSessionCount: 1,
          therapistNetAmountCents: 7000,
          therapyId: "therapy-1",
          therapyNameSnapshot: "Reiki",
        },
      ],
      sessions: {
        cancellationRate: null,
        cancelledCount: 0,
        completedCount: 1,
        eligibleScheduledCount: 0,
        rescheduleRate: null,
        rescheduledCount: 0,
      },
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    });

    expect(metrics.period.isPartial).toBe(true);
    expect(metrics.revenue.netAverageTicketCents).toBe(7000);
    expect(metrics.retention.status).toBe("insufficient_data");
    expect(
      metrics.financialEvolution[0]?.previousPeriodNetAmountCents,
    ).toBeNull();
  });

  it("maps F3 advanced financial dashboard with separated forecast and privacy benchmark status", () => {
    const dashboard = mapTherapistAdvancedFinancialDashboard({
      agendaPotential: {
        availableMinutes: 420,
        capacityMinutes: 720,
        committedMinutes: 180,
        confidence: "medium",
        conservativePotentialCents: 48000,
        estimatedBookableSlots: 6,
        expectedPotentialCents: 60000,
        maximumPotentialCents: 72000,
        methodologyVersion: "tes-agenda-potential-v1",
        occupancyRate: 25,
        reason: null,
        status: "available",
        windowEnd: "2026-07-31",
        windowStart: "2026-07-28",
      },
      benchmark: {
        cohortDescription: null,
        methodologyVersion: "tes-financial-benchmark-v1",
        metrics: {
          averageTicketCents: {
            cohortMedian: null,
            percentile: null,
            therapistValue: 10000,
          },
          occupancyRate: {
            cohortMedian: null,
            percentile: null,
            therapistValue: 25,
          },
          returnRate: {
            cohortMedian: null,
            percentile: null,
            therapistValue: 60,
          },
        },
        minimumSessions: 100,
        minimumTherapists: 20,
        sampleSize: null,
        status: "insufficient_sample",
      },
      contractVersion: 2,
      financialEvolution: [
        {
          contractedNetCents: 8000,
          periodEnd: "2026-07-05",
          periodStart: "2026-06-29",
          previousPeriodNetCents: 5000,
          projectedNetCents: 14000,
          realizedNetCents: 7000,
        },
      ],
      forecast: {
        confidence: "medium",
        contractedFutureNetCents: 8000,
        contractedMonthNetCents: 15000,
        estimatedOpenAgendaPotentialCents: 60000,
        methodologyVersion: "tes-financial-forecast-v1",
        realizedNetCents: 7000,
        reason: null,
        status: "available",
        totalEstimatedPotentialCents: 75000,
      },
      insights: {
        items: [
          {
            action: "open_agenda",
            code: "agenda_open_potential",
            evidence: [
              {
                metric: "availableMinutes",
                periodEnd: "2026-07-31",
                periodStart: "2026-07-28",
                value: 420,
              },
            ],
            explanation: "Há horários online disponíveis.",
            generatedAt: "2026-07-28T12:00:00.000Z",
            methodologyVersion: "tes-financial-opportunities-v1",
            title: "Potencial disponível da agenda",
          },
        ],
        methodologyVersion: "tes-financial-opportunities-v1",
        status: "available",
      },
      methodologies: [
        {
          description: "Separa realizado, contratado e estimado.",
          version: "tes-financial-forecast-v1",
        },
      ],
      opportunities: {
        items: [
          {
            action: "open_agenda",
            code: "agenda_open_potential",
            confidence: "medium",
            description: "Há horários online disponíveis.",
            estimatedImpactCents: 60000,
            evidence: [
              {
                metric: "availableMinutes",
                periodEnd: "2026-07-31",
                periodStart: "2026-07-28",
                value: 420,
              },
            ],
            generatedAt: "2026-07-28T12:00:00.000Z",
            methodologyVersion: "tes-financial-opportunities-v1",
            title: "Potencial disponível da agenda",
          },
        ],
        methodologyVersion: "tes-financial-opportunities-v1",
        primary: {
          action: "open_agenda",
          code: "agenda_open_potential",
          confidence: "medium",
          description: "Há horários online disponíveis.",
          estimatedImpactCents: 60000,
          evidence: [
            {
              metric: "availableMinutes",
              periodEnd: "2026-07-31",
              periodStart: "2026-07-28",
              value: 420,
            },
          ],
          generatedAt: "2026-07-28T12:00:00.000Z",
          methodologyVersion: "tes-financial-opportunities-v1",
          title: "Potencial disponível da agenda",
        },
        status: "available",
      },
      period: {
        end: "2026-07-28",
        forecastMonthEnd: "2026-07-31",
        forecastMonthStart: "2026-07-01",
        generatedAt: "2026-07-28T12:00:00.000Z",
        isPartial: true,
        previousEnd: "2026-06-28",
        previousStart: "2026-05-30",
        start: "2026-06-29",
        timezone: "America/Sao_Paulo",
      },
      plan: "premium_plus",
      retention: {
        cohorts: [
          {
            censoredPatients: 1,
            cohortMonth: "2026-07-01",
            newPatients: 3,
            returnRate: 50,
            returningPatients: 1,
            withoutReturnPatients: 1,
          },
        ],
        eligiblePatients: 10,
        medianDaysToReturn: 21,
        methodologyVersion: "tes-retention-v1",
        minimumEligiblePatients: 10,
        observationWindowsDays: [30, 60, 90],
        primaryWindowDays: 90,
        returningPatients: 6,
        returnRate: 60,
        status: "available",
        withoutReturnPatients: 4,
      },
      revenueByTherapy: [
        {
          averageTicketCents: 10000,
          grossAmountCents: 10000,
          paidSessionCount: 1,
          revenueSharePercent: 100,
          therapistNetAmountCents: 7000,
          therapyId: "therapy-1",
          therapyNameSnapshot: "Reiki",
          trend: {
            absoluteDelta: 2000,
            comparisonStatus: "available",
            currentValue: 7000,
            percentageDelta: 40,
            previousValue: 5000,
          },
        },
      ],
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    });

    expect(dashboard.forecast.realizedNetCents).toBe(7000);
    expect(dashboard.forecast.contractedFutureNetCents).toBe(8000);
    expect(dashboard.forecast.estimatedOpenAgendaPotentialCents).toBe(60000);
    expect(dashboard.benchmark.status).toBe("insufficient_sample");
    expect(dashboard.revenueByTherapy[0]?.revenueSharePercent).toBe(100);
  });

  it("maps the charge-focused receipt contract", () => {
    const receipts = mapTherapistReceiptsContract({
      contractVersion: 5,
      filters: {
        periodEnd: "2026-07-28",
        periodStart: "2026-06-29",
        search: "Lucas",
        status: "refunded",
        therapyId: null,
        timezone: "America/Sao_Paulo",
      },
      generatedAt: "2026-07-28T12:00:00.000Z",
      items: [
        {
          bankTransferAmountCents: 3000,
          bookingId: "f6100000-0000-4000-8000-000000000001",
          chargeStatus: "refunded",
          createdAt: "2026-07-28T12:00:00.000Z",
          debtOffsetAmountCents: 1000,
          financialStatus: "partially_refunded",
          grossAmountCents: 5000,
          patientDisplayName: "Lucas",
          receiptUrl: null,
          receiptStatus: "refunded",
          refundedAmountCents: 1000,
          scheduledChargeAt: null,
          sessionDate: "2026-07-28T13:00:00.000Z",
          sessionPaymentId: "f6200000-0000-4000-8000-000000000001",
          tesCommissionCents: 1000,
          therapistNetAmountCents: 3000,
          therapyNameSnapshot: "Reiki",
        },
      ],
      pagination: {
        hasNextPage: false,
        page: 1,
        pageSize: 12,
        totalCount: 1,
        totalPages: 1,
      },
      summary: {
        approvedCents: 0,
        processingCents: 0,
        refundedCents: 1000,
        scheduledCents: 0,
      },
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      therapyOptions: [{ name: "Reiki", therapyId: "therapy-1" }],
    });

    expect(receipts.items[0]).toMatchObject({
      bankTransferAmountCents: 3000,
      chargeStatus: "refunded",
      debtOffsetAmountCents: 1000,
      receiptStatus: "refunded",
      refundedAmountCents: 1000,
      therapistNetAmountCents: 3000,
    });
  });

  it("maps the simplified payout agenda and history", () => {
    const payouts = mapTherapistPayoutsContract({
      agenda: {
        awaitingBankDate: [
          {
            amountCents: 4000,
            composition: [],
            date: null,
            id: "bank-date-pending",
            sessionCount: 1,
            status: "awaiting_bank_date",
          },
        ],
        balanceAvailable: [
          {
            amountCents: 10455,
            composition: [],
            date: "2026-08-01",
            id: "balance:2026-08-01",
            sessionCount: 1,
            status: "balance_schedule",
          },
        ],
        days: 15,
        inTransit: [
          {
            amountCents: 8000,
            composition: [
              {
                amountCents: 8000,
                bookingId: "f6100000-0000-4000-8000-000000000001",
                patientDisplayName: "Lucas",
                sessionDate: "2026-07-28T13:00:00.000Z",
                sessionPaymentId: "f6200000-0000-4000-8000-000000000001",
                therapyNameSnapshot: "Reiki",
              },
            ],
            date: "2026-07-30",
            id: "in-transit:2026-07-30",
            sessionCount: 1,
            status: "in_transit",
          },
        ],
        periodEnd: "2026-08-11",
        periodStart: "2026-07-28",
        predicted: [],
      },
      contractVersion: 6,
      filters: {
        agendaDays: 15,
        periodEnd: "2026-07-28",
        periodStart: "2026-06-29",
        timezone: "America/Sao_Paulo",
      },
      generatedAt: "2026-07-28T12:00:00.000Z",
      historyItems: [
        {
          amountCents: 8000,
          composition: [],
          date: "2026-07-27",
          id: "received:2026-07-27",
          sessionCount: 1,
          status: "received",
        },
      ],
      pagination: {
        hasNextPage: false,
        page: 1,
        pageSize: 12,
        totalCount: 1,
        totalPages: 1,
      },
      summary: {
        expectedCents: 0,
        inTransitCents: 8000,
        receivedCents: 8000,
      },
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    });

    expect(payouts.agenda.inTransit[0]?.amountCents).toBe(8000);
    expect(payouts.agenda.balanceAvailable[0]?.date).toBe("2026-08-01");
    expect(payouts.agenda.awaitingBankDate[0]?.date).toBeNull();
    expect(payouts.agenda.inTransit[0]?.status).toBe("in_transit");
    expect(payouts.historyItems[0]?.status).toBe("received");
    expect(payouts.summary.receivedCents).toBe(8000);
  });

  it("never accepts a bank-account summary in the Connect read model", () => {
    const account = mapTherapistConnectAccount({
      accountExists: true,
      chargesEnabled: false,
      contractVersion: 1,
      currentlyDue: [],
      detailsSubmitted: true,
      disabledReason: null,
      eventuallyDue: ["business_profile.url"],
      generatedAt: "2026-07-28T12:00:00.000Z",
      lastSyncedAt: "2026-07-28T11:00:00.000Z",
      maskedAccountId: "acct_...cdef",
      maskedBankAccountSummary: null,
      onboardingStatus: "ready",
      payoutsEnabled: true,
      pendingVerification: [],
      previousAccountClosed: false,
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      transferCapabilityStatus: "active",
    });

    expect(account.maskedBankAccountSummary).toBeNull();
    expect(account.maskedAccountId).toBe("acct_...cdef");
  });
});
