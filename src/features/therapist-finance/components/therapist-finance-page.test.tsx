import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  TherapistAdvancedFinancialDashboard,
  TherapistFinanceFilters,
  TherapistFinancePageData,
  TherapistFinancialStatus,
} from "../therapist-finance.types";
import { financialReceiptCopyByStatus } from "./financial-formatters";
import { TherapistFinancePage } from "./therapist-finance-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("TherapistFinancePage", () => {
  it("renders the four approved tabs and no dedicated history tab", () => {
    renderPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Financeiro completo",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resumo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Recebimentos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Repasses" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conta de recebimento" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Histórico$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the approved value composition without adjustments", () => {
    renderPage();

    expect(screen.getAllByText("Valor bruto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Comissão TES").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Valor líquido").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(new RegExp(["ajus", "tes"].join(""), "i")),
    ).not.toBeInTheDocument();
  });

  it("renders Premium financial metrics and locks the Premium Plus dashboard", () => {
    renderPage();

    expect(
      screen.getAllByRole("heading", { name: "Ticket médio" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Terapias que mais faturam").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Evolução financeira").length).toBeGreaterThan(
      0,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Sua agenda e potencial.*Premium Plus/i,
      }),
    );
    expect(
      screen.getByRole("link", { name: "Conhecer Premium Plus" }),
    ).toHaveAttribute("href", "/terapeuta/plano");
    expect(
      screen.queryByRole("heading", { name: "Evolução com projeção" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Benchmark anonimizado" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Premium Plus readings in the summary without the advanced accordion", () => {
    renderPage("summary", {
      advanced: {
        dashboard: advancedFixture(),
        status: "available",
      },
      analytics: {
        metrics: {
          ...fixture().analytics.metrics!,
          plan: "premium_plus",
        },
        status: "available",
      },
      overview: {
        ...fixture().overview,
        plan: "premium_plus",
      },
    });

    expect(
      screen.getByRole("heading", { name: "Sua agenda e potencial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Oportunidade do mês" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Realizado líquido").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Potencial estimado").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/não representa receita garantida/i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Análises avançadas")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Previsão do mês" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Benchmark anonimizado" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Benchmark suprimido por privacidade estatística/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Dica TES" }),
    ).not.toBeInTheDocument();
  });

  it("keeps advanced summary metrics locked for Free therapists", () => {
    renderPage("summary", {
      analytics: {
        metrics: null,
        requiredPlan: "Premium",
        status: "locked",
      },
      overview: {
        ...fixture().overview,
        plan: "free",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Panorama financeiro.*Premium/i,
      }),
    );
    expect(
      screen.getByRole("link", { name: "Conhecer Premium" }),
    ).toHaveAttribute("href", "/terapeuta/plano");
    expect(screen.queryByText("Seu dinheiro")).not.toBeInTheDocument();
  });

  it("keeps payment method and payment origin separated in receipts", () => {
    renderPage("receipts");

    expect(
      screen.getByRole("heading", { name: "Recebimentos do período" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Veja cada recebimento, sua sessão e a forma de pagamento.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Cartão").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pagamento online").length).toBeGreaterThan(0);
    expect(screen.getByText("Reembolsos")).toBeInTheDocument();
    expect(screen.getByText("Recebimentos por semana")).toBeInTheDocument();
    expect(screen.getByText("Distribuição por status")).toBeInTheDocument();
  });

  it.each(Object.entries(financialReceiptCopyByStatus))(
    "renders dynamic receipts copy for %s",
    (status, copy) => {
      const baseReceipts = fixture().receipts;

      renderPage(
        "receipts",
        {
          receipts: {
            ...baseReceipts,
            items: [],
            pagination: {
              ...baseReceipts.pagination,
              totalCount: 0,
              totalPages: 1,
            },
          },
        },
        { status: status as TherapistFinancialStatus },
      );

      expect(
        screen.getByRole("heading", { name: copy.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(copy.description)).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: copy.emptyTitle }),
      ).toBeInTheDocument();
      expect(screen.getByText(copy.emptyDescription)).toBeInTheDocument();
    },
  );

  it("keeps the selected status copy while rendering matching receipts", () => {
    const baseReceipts = fixture().receipts;
    const copy = financialReceiptCopyByStatus.canceled;

    renderPage(
      "receipts",
      {
        receipts: {
          ...baseReceipts,
          items: [
            {
              ...baseReceipts.items[0],
              financialStatus: "canceled",
            },
          ],
        },
      },
      { status: "canceled" },
    );

    expect(
      screen.getByRole("heading", { name: copy.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.description)).toBeInTheDocument();
    expect(screen.getAllByText("Lucas").length).toBeGreaterThan(0);
    expect(screen.queryByText(copy.emptyTitle)).not.toBeInTheDocument();
  });

  it("preserves receipt filters in pagination and clear-filter links", () => {
    const baseReceipts = fixture().receipts;

    renderPage(
      "receipts",
      {
        receipts: {
          ...baseReceipts,
          pagination: {
            ...baseReceipts.pagination,
            hasNextPage: true,
            totalCount: 13,
            totalPages: 2,
          },
        },
      },
      {
        search: "Lucas",
        status: "canceled",
        therapyId: "therapy-1",
      },
    );

    expect(
      screen.getByRole("link", { name: "Próxima página" }),
    ).toHaveAttribute(
      "href",
      "/terapeuta/financeiro?tab=recebimentos&page=2&status=canceled&therapyId=therapy-1&q=Lucas",
    );
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", "/terapeuta/financeiro?tab=recebimentos");
  });

  it("does not render a local bank-data form for Connect", () => {
    renderPage("account", {
      account: {
        ...fixture().account,
        accountExists: false,
        onboardingStatus: "not_started",
      },
    });

    expect(
      screen.getByRole("heading", {
        name: "Conecte sua conta de recebimento",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Conectar conta de recebimento" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/agência/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^conta$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/pix/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cpf/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cnpj/i)).not.toBeInTheDocument();
  });

  it("asks for a new receiving account after the prior account is closed", () => {
    renderPage("account", {
      account: {
        ...fixture().account,
        accountExists: false,
        maskedAccountId: null,
        onboardingStatus: "not_started",
        previousAccountClosed: true,
      },
    });

    expect(
      screen.getByRole("heading", { name: "Conta de recebimento pendente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar nova conta de recebimento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sua conta de recebimento anterior foi encerrada. Crie uma nova conta para que os pr\u00f3ximos repasses possam continuar.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/prÃ³ximos repasses/i)).not.toBeInTheDocument();
    expect(screen.queryByText("acct_...cdef")).not.toBeInTheDocument();
  });

  it("shows the next payout card with the scheduled batch date instead of duplicating the eligible amount", () => {
    renderPage("payouts", {
      payouts: {
        ...fixture().payouts,
        filters: {
          ...fixture().payouts.filters,
          timezone: "America/Sao_Paulo",
        },
        summary: {
          ...fixture().payouts.summary,
          eligibleForPayoutCents: 8000,
          nextBatchAt: "2026-07-31T13:00:00.000Z",
        },
      },
    });

    expect(screen.getAllByText("31/07/2026, 10:00").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Próximo repasse previsto para 31/07/2026, 10:00."),
    ).toBeInTheDocument();
  });
});

function renderPage(
  tab: "account" | "payouts" | "receipts" | "summary" = "summary",
  overrides: Partial<TherapistFinancePageData> = {},
  filtersOverride: Partial<TherapistFinanceFilters> = {},
) {
  const data = { ...fixture(), ...overrides };

  render(
    <TherapistFinancePage
      data={data}
      dateRange={{ end: "2026-07-28", key: "30", start: "2026-06-29" }}
      filters={{
        page: 1,
        payoutStatus: null,
        search: null,
        status: null,
        therapyId: null,
        ...filtersOverride,
      }}
      tab={tab}
    />,
  );
}

function fixture(): TherapistFinancePageData {
  return {
    account: {
      accountExists: true,
      chargesEnabled: false,
      contractVersion: 1,
      currentlyDue: [],
      detailsSubmitted: true,
      disabledReason: null,
      eventuallyDue: [],
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
    },
    advanced: {
      dashboard: null,
      requiredPlan: "Premium Plus",
      status: "locked",
    },
    analytics: {
      metrics: {
        contractVersion: 1,
        financialEvolution: [
          {
            grossAmountCents: 10000,
            periodEnd: "2026-07-05",
            periodStart: "2026-06-29",
            previousPeriodNetAmountCents: 5000,
            therapistNetAmountCents: 7000,
          },
        ],
        metricDefinitionVersion: 1,
        period: {
          end: "2026-07-28",
          generatedAt: "2026-07-28T12:00:00.000Z",
          isPartial: true,
          previousEnd: "2026-06-28",
          previousStart: "2026-05-30",
          start: "2026-06-29",
          timezone: "America/Sao_Paulo",
        },
        plan: "premium",
        retention: {
          eligiblePatients: 10,
          minimumEligiblePatients: 10,
          observationWindowDays: 90,
          returningPatients: 6,
          returnRate: 60,
          status: "available",
        },
        revenue: {
          comparison: {
            averageTicket: {
              absoluteDelta: 2000,
              comparisonStatus: "available",
              currentValue: 7000,
              percentageDelta: 40,
              previousValue: 5000,
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
              comparisonStatus: "available",
              currentValue: 1,
              percentageDelta: 100,
              previousValue: 0,
            },
            therapistNet: {
              absoluteDelta: 2000,
              comparisonStatus: "available",
              currentValue: 7000,
              percentageDelta: 40,
              previousValue: 5000,
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
          cancellationRate: 10,
          cancelledCount: 1,
          completedCount: 1,
          eligibleScheduledCount: 10,
          rescheduleRate: 20,
          rescheduledCount: 2,
        },
        therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      },
      status: "available",
    },
    overview: {
      blockedCents: 0,
      contractVersion: 1,
      disputedCents: 0,
      eligibleForPayoutCents: 8000,
      generatedAt: "2026-07-28T12:00:00.000Z",
      grossPaidCents: 10000,
      payoutProcessingCents: 0,
      periodEnd: "2026-07-28",
      periodStart: "2026-06-29",
      plan: "premium",
      refundedToCustomersCents: 1000,
      tesCommissionCents: 2000,
      therapistNetCents: 7000,
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      timezone: "America/Sao_Paulo",
      transferredCents: 8000,
      waitingConfirmationCents: 0,
      waitingSafetyPeriodCents: 0,
    },
    payouts: {
      contractVersion: 1,
      filters: {
        periodEnd: "2026-07-28",
        periodStart: "2026-06-29",
        status: null,
        timezone: "America/Sao_Paulo",
      },
      generatedAt: "2026-07-28T12:00:00.000Z",
      items: [
        {
          blockedReason: null,
          expectedTransferAt: "2026-07-30T12:00:00.000Z",
          failedReason: null,
          grossAmountCents: 10000,
          payoutBatchId: "batch-1",
          periodEnd: "2026-07-07",
          periodStart: "2026-07-01",
          reconciliationStatus: "matched",
          reconciliationUpdatedAt: "2026-07-30T13:00:00.000Z",
          refundedAmountCents: 0,
          sessionCount: 1,
          stripeSourceChargeId: "ch_test",
          stripeTransferId: "tr_test",
          tesCommissionCents: 2000,
          therapistNetAmountCents: 8000,
          transferredAt: "2026-07-30T13:00:00.000Z",
          transferStatus: "transferred",
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
        blockedCents: 0,
        eligibleForPayoutCents: 8000,
        nextBatchAt: null,
        payoutProcessingCents: 0,
        waitingConfirmationCents: 0,
        waitingSafetyPeriodCents: 0,
      },
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    },
    receipts: {
      contractVersion: 1,
      filters: {
        periodEnd: "2026-07-28",
        periodStart: "2026-06-29",
        search: null,
        status: null,
        therapyId: null,
        timezone: "America/Sao_Paulo",
      },
      generatedAt: "2026-07-28T12:00:00.000Z",
      items: [
        {
          bookingId: "booking-1",
          createdAt: "2026-07-28T12:00:00.000Z",
          disputeStatus: null,
          financialStatus: "partially_refunded",
          grossAmountCents: 10000,
          patientDisplayName: "Lucas",
          paymentMethodType: "card",
          paymentOrigin: "stripe_checkout",
          receiptUrl: "https://stripe.test/receipt",
          refundedAmountCents: 1000,
          sessionDate: "2026-07-28T13:00:00.000Z",
          sessionPaymentId: "payment-1",
          tesCommissionCents: 2000,
          therapistNetAmountCents: 7000,
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
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      therapyOptions: [{ name: "Reiki", therapyId: "therapy-1" }],
    },
  };
}

function advancedFixture(): TherapistAdvancedFinancialDashboard {
  return {
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
    contractVersion: 1,
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
          explanation:
            "Há horários online disponíveis que podem receber novas reservas.",
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
          description:
            "Há horários online disponíveis que podem receber novas reservas.",
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
        description:
          "Há horários online disponíveis que podem receber novas reservas.",
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
  };
}
