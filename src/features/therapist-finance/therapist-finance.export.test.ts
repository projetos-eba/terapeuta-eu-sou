import { describe, expect, it } from "vitest";

import { buildTherapistFinanceCsv } from "./therapist-finance.export";
import type {
  TherapistFinancialOverview,
  TherapistPayoutsContract,
  TherapistReceiptsContract,
} from "./therapist-finance.types";

describe("buildTherapistFinanceCsv", () => {
  it("creates a human-readable report without internal identifiers", () => {
    const csv = buildTherapistFinanceCsv({
      generatedAt: new Date("2026-09-29T12:00:00.000Z"),
      overview: overview(),
      payouts: payouts(),
      receipts: receipts(),
    });

    expect(csv.startsWith("\ufeffRelatório financeiro\r\n")).toBe(true);
    expect(csv).toContain("Resumo financeiro");
    expect(csv).toContain("Recebimentos do período");
    expect(csv).toContain("Repasses");
    expect(csv).toContain("Indicadores complementares");
    expect(csv).toContain("Constelação Familiar;Bruno;Confirmada");
    expect(csv).not.toContain("payment-internal-id");
    expect(csv).not.toContain("booking-internal-id");
  });
});

function overview(): TherapistFinancialOverview {
  return {
    blockedCents: 0, contractVersion: 3, disputedCents: 0, eligibleForPayoutCents: 10000,
    generatedAt: "2026-09-29T12:00:00.000Z", grossPaidCents: 12000, payoutProcessingCents: 0,
    processingCents: 0, receivedCents: 0, periodEnd: "2026-09-29", periodStart: "2026-09-01",
    plan: "premium", refundedToCustomersCents: 0, tesCommissionCents: 2000,
    therapistNetCents: 10000, therapistProfileId: "profile-internal-id", transferredCents: 0,
    timezone: "America/Sao_Paulo", waitingConfirmationCents: 0, waitingSafetyPeriodCents: 0,
    waitingSettlementCents: 0,
  };
}

function receipts(): TherapistReceiptsContract {
  return {
    contractVersion: 6,
    filters: { periodEnd: "2026-09-29", periodStart: "2026-09-01", search: null, status: null, therapyId: null, timezone: "America/Sao_Paulo" },
    generatedAt: "2026-09-29T12:00:00.000Z",
    items: [{ bankTransferAmountCents: null, bookingId: "booking-internal-id", chargeStatus: "approved", createdAt: "2026-09-20T12:00:00.000Z", debtOffsetAmountCents: null, financialStatus: "paid", grossAmountCents: 12000, patientDisplayName: "Bruno", receiptStatus: "paid", receiptUrl: null, refundedAmountCents: 0, scheduledChargeAt: null, sessionDate: "2026-09-20T12:00:00.000Z", sessionPaymentId: "payment-internal-id", tesCommissionCents: 2000, therapistNetAmountCents: 10000, therapyNameSnapshot: "Constelação Familiar" }],
    pagination: { hasNextPage: false, page: 1, pageSize: 1, totalCount: 1, totalPages: 1 },
    summary: { approvedCents: 12000, processingCents: 0, refundedCents: 0, scheduledCents: 0, upcomingScheduled: { amountCents: 0, periodEnd: "2026-10-28", periodStart: "2026-09-29", sessionCount: 0 } },
    therapistProfileId: "profile-internal-id", therapyOptions: [],
  };
}

function payouts(): TherapistPayoutsContract {
  return {
    agenda: { awaitingBankDate: [], balanceAvailable: [], days: 15, inTransit: [], periodEnd: "2026-10-13", periodStart: "2026-09-29", predicted: [] },
    contractVersion: 10,
    filters: { agendaDays: 15, periodEnd: "2026-09-29", periodStart: "2026-09-01", timezone: "America/Sao_Paulo" },
    generatedAt: "2026-09-29T12:00:00.000Z", historyItems: [],
    pagination: { hasNextPage: false, page: 1, pageSize: 1, totalCount: 0, totalPages: 0 },
    summary: { expectedCents: 10000, inTransitCents: 0, receivedCents: 0 }, therapistProfileId: "profile-internal-id",
  };
}
