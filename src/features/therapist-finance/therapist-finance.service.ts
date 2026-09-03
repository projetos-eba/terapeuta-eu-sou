import "server-only";

import { cache } from "react";

import {
  createCorrelationId,
  logServerOperationFailure,
} from "@/lib/observability/server-operation-log";
import { TherapistPlan } from "@/domain/tes";

import {
  getTherapistFinanceErrorMessage,
  TherapistFinanceError,
} from "./therapist-finance.errors";
import {
  mapTherapistAdvancedFinancialDashboard,
  mapTherapistConnectAccount,
  mapTherapistFinancialOverview,
  mapTherapistFinancialMetrics,
  mapTherapistPayoutsContract,
  mapTherapistReceiptsContract,
} from "./therapist-finance.mappers";
import {
  queryTherapistAdvancedFinancialDashboard,
  queryTherapistConnectAccount,
  queryTherapistFinancialMetrics,
  queryTherapistFinancialOverview,
  queryTherapistPayouts,
  queryTherapistReceipts,
} from "./therapist-finance.queries";
import type {
  TherapistFinanceDateRange,
  TherapistFinanceFilters,
  TherapistFinancePageData,
  TherapistFinancialOverview,
} from "./therapist-finance.types";

export type TherapistFinancePageResult =
  | {
      data: TherapistFinancePageData;
      status: "success";
    }
  | {
      code: TherapistFinanceError["code"];
      message: string;
      status: "error";
    };

export const getTherapistFinancePage = cache(
  async function getTherapistFinancePage({
    accessToken,
    dateRange,
    filters,
    includeAdvancedFinancials,
    includeMetrics,
    plan,
    profileId,
  }: {
    accessToken: string;
    dateRange: TherapistFinanceDateRange;
    filters: TherapistFinanceFilters;
    includeAdvancedFinancials: boolean;
    includeMetrics: boolean;
    plan: TherapistPlan;
    profileId: string;
  }): Promise<TherapistFinancePageResult> {
    const startedAt = performance.now();
    const periodBody = {
      p_period_end: dateRange.end,
      p_period_start: dateRange.start,
      p_timezone: "America/Sao_Paulo",
    };

    try {
      const [overview, receipts, payouts, account] = await Promise.all([
        queryTherapistFinancialOverview(accessToken, periodBody),
        queryTherapistReceipts(accessToken, {
          ...periodBody,
          p_page: 1,
          p_page_size: Math.min(filters.page * 6, 500),
          p_search: filters.search,
          p_status: filters.status,
          p_therapy_id: filters.therapyId,
        }),
        queryTherapistPayouts(accessToken, {
          ...periodBody,
          p_page: 1,
          p_page_size: Math.min(filters.page * 6, 500),
          p_status: filters.payoutStatus,
        }),
        queryTherapistConnectAccount(accessToken),
      ]);

      const mappedOverview = mapTherapistFinancialOverview(overview);
      const data: TherapistFinancePageData = {
        account: mapTherapistConnectAccount(account),
        advanced: includeAdvancedFinancials
          ? {
              dashboard: mapTherapistAdvancedFinancialDashboard(
                await queryTherapistAdvancedFinancialDashboard(
                  accessToken,
                  periodBody,
                ),
              ),
              status: "available",
            }
          : {
              dashboard: null,
              requiredPlan: "Premium Plus",
              status: "locked",
            },
        analytics: includeMetrics
          ? {
              metrics: mapTherapistFinancialMetrics(
                await queryTherapistFinancialMetrics(accessToken, periodBody),
              ),
              status: "available",
            }
          : {
              metrics: null,
              requiredPlan: "Premium",
              status: "locked",
            },
        overview: maskLockedOverview(mappedOverview, plan),
        payouts: mapTherapistPayoutsContract(payouts),
        receipts: mapTherapistReceiptsContract(receipts),
      };

      enforceProfile(data.overview.therapistProfileId, profileId);
      if (data.analytics.status === "available") {
        enforceProfile(data.analytics.metrics.therapistProfileId, profileId);
      }
      if (data.advanced.status === "available") {
        enforceProfile(data.advanced.dashboard.therapistProfileId, profileId);
      }
      enforceProfile(data.receipts.therapistProfileId, profileId);
      enforceProfile(data.payouts.therapistProfileId, profileId);
      enforceProfile(data.account.therapistProfileId, profileId);

      return {
        data,
        status: "success",
      };
    } catch (error) {
      const code =
        error instanceof TherapistFinanceError ? error.code : "unavailable";

      logServerOperationFailure({
        actorRole: "therapist",
        correlationId: createCorrelationId(),
        durationMs: performance.now() - startedAt,
        errorCode: code,
        operation: "therapist_finance_page",
      });

      return {
        code,
        message: getTherapistFinanceErrorMessage(code),
        status: "error",
      };
    }
  },
);

function enforceProfile(actualProfileId: string, expectedProfileId: string) {
  if (actualProfileId !== expectedProfileId) {
    throw new TherapistFinanceError("forbidden");
  }
}

function maskLockedOverview(
  overview: TherapistFinancialOverview,
  plan: TherapistPlan,
) {
  if (plan !== TherapistPlan.Free) return overview;

  return {
    ...overview,
    blockedCents: 0,
    disputedCents: 0,
    eligibleForPayoutCents: 0,
    grossPaidCents: 0,
    payoutProcessingCents: 0,
    processingCents: 0,
    receivedCents: 0,
    refundedToCustomersCents: 0,
    tesCommissionCents: 0,
    therapistNetCents: 0,
    transferredCents: 0,
    waitingConfirmationCents: 0,
    waitingSafetyPeriodCents: 0,
    waitingSettlementCents: 0,
  } satisfies TherapistFinancialOverview;
}
