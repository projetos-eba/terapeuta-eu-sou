import {
  getTherapistFinancePage,
  TherapistFinanceErrorState,
  TherapistFinancePage,
  type TherapistFinanceFilters,
  type TherapistFinanceTab,
} from "@/features/therapist-finance";
import { resolveTherapistFinanceDateRange } from "@/features/therapist-finance/therapist-finance-date-range";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { canUseTherapistCapability } from "@/domain/tes";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

const financialStatuses = new Set([
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

const payoutStatuses = new Set([
  "bank_pending",
  "batched",
  "blocked",
  "failed",
  "paid",
  "reversed",
  "transfer_pending",
]);

export default async function TherapistFinanceRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireTherapistSession(therapistRoutePolicies.finance);
  const tab = parseTab(first(params?.tab));
  const dateRange = resolveTherapistFinanceDateRange(
    first(params?.period),
    first(params?.start),
    first(params?.end),
  );
  const filters = parseFilters(params);
  const result = await getTherapistFinancePage({
    accessToken: session.accessToken,
    dateRange,
    filters,
    includeAdvancedFinancials: canUseTherapistCapability(
      session.plan,
      "advanced_financials",
    ),
    includeMetrics: canUseTherapistCapability(session.plan, "advanced_metrics"),
    plan: session.plan,
    profileId: session.profileId,
  });

  if (result.status === "error") {
    return <TherapistFinanceErrorState message={result.message} />;
  }

  return (
    <TherapistFinancePage
      connectNotice={parseConnectNotice(first(params?.connect))}
      data={result.data}
      dateRange={dateRange}
      filters={filters}
      tab={tab}
    />
  );
}

function parseTab(value: string | undefined): TherapistFinanceTab {
  if (value === "recebimentos" || value === "receipts") return "receipts";
  if (value === "repasses" || value === "payouts") return "payouts";
  if (value === "account" || value === "conta") return "account";
  return "summary";
}

function parseFilters(
  params: Record<string, string | string[] | undefined> | undefined,
): TherapistFinanceFilters {
  const status = first(params?.status);
  const payoutStatus = first(params?.payoutStatus);
  const page = Number.parseInt(first(params?.page) ?? "1", 10);

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    payoutStatus:
      payoutStatus && payoutStatuses.has(payoutStatus)
        ? (payoutStatus as TherapistFinanceFilters["payoutStatus"])
        : null,
    search: normalizeSearch(first(params?.q)),
    status:
      status === "waiting_safety_period"
        ? "waiting_settlement"
        : status && financialStatuses.has(status)
          ? (status as TherapistFinanceFilters["status"])
          : null,
    therapyId: normalizeUuid(first(params?.therapyId)),
  };
}

function parseConnectNotice(value: string | undefined) {
  if (value === "refresh" || value === "return") return value;
  return undefined;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearch(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

function normalizeUuid(value: string | undefined) {
  if (!value) return null;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}
