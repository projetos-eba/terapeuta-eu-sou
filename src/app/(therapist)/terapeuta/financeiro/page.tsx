import {
  getTherapistFinancePage,
  TherapistFinanceErrorState,
  TherapistFinancePage,
  type TherapistFinanceDateRange,
  type TherapistFinanceFilters,
  type TherapistFinanceTab,
} from "@/features/therapist-finance";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { canUseTherapistCapability } from "@/domain/tes";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

const financialStatuses = new Set([
  "canceled",
  "disputed",
  "failed",
  "paid",
  "partially_refunded",
  "pending",
  "processing",
  "refunded",
]);

const payoutStatuses = new Set([
  "batched",
  "blocked",
  "eligible",
  "failed",
  "reversed",
  "transferred",
  "transfer_pending",
  "waiting_confirmation",
  "waiting_safety_period",
]);

export default async function TherapistFinanceRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireTherapistSession(therapistRoutePolicies.finance);
  const tab = parseTab(first(params?.tab));
  const dateRange = parseDateRange(first(params?.period));
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

function parseDateRange(value: string | undefined): TherapistFinanceDateRange {
  const key = value === "90" || value === "month" ? value : "30";
  const today = todayInSaoPaulo();

  if (key === "month") {
    return {
      end: today,
      key,
      start: `${today.slice(0, 8)}01`,
    };
  }

  return {
    end: today,
    key,
    start: addDays(today, key === "90" ? -89 : -29),
  };
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
      status && financialStatuses.has(status)
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

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "01";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
