import "server-only";

import type { TherapistPlan } from "@/domain/tes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type {
  TherapistBillingStatus,
  TherapistPlanPageData,
} from "./therapist-plan.types";

export class TherapistPlanQueryError extends Error {}

export async function getTherapistPlanPageData({
  accessToken,
  effectivePlan,
  profileId,
}: {
  accessToken: string;
  effectivePlan: TherapistPlan;
  profileId: string;
}): Promise<TherapistPlanPageData> {
  const config = getSupabasePublicConfig();
  if (!config) throw new TherapistPlanQueryError("unavailable");

  const headers = {
    apikey: config.apiKey,
    Authorization: `Bearer ${accessToken}`,
  };
  const catalogQuery = new URLSearchParams({
    is_active: "eq.true",
    order: "code.asc",
    select:
      "code,name,description,prices:billing_plan_prices(unit_amount_cents,currency,interval,is_active,is_public)",
  });
  const subscriptionQuery = new URLSearchParams({
    limit: "1",
    order: "created_at.desc",
    select: "plan_code,status,current_period_end,cancel_at_period_end,metadata",
    status: "in.(active,trialing,past_due,unpaid,paused,incomplete)",
    therapist_profile_id: `eq.${profileId}`,
  });
  const [catalogResponse, subscriptionResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/billing_plans?${catalogQuery}`, {
      cache: "no-store",
      headers,
    }),
    fetch(
      `${config.url}/rest/v1/therapist_subscriptions?${subscriptionQuery}`,
      { cache: "no-store", headers },
    ),
  ]);

  if (!catalogResponse.ok || !subscriptionResponse.ok) {
    throw new TherapistPlanQueryError("unavailable");
  }

  const catalogRows = (await catalogResponse.json()) as unknown[];
  const subscriptionRows = (await subscriptionResponse.json()) as unknown[];

  const catalog = catalogRows
    .map(mapCatalogItem)
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort(sortPlans);
  assertCatalog(catalog);

  return {
    catalog,
    effectivePlan,
    subscription: subscriptionRows[0]
      ? mapSubscription(subscriptionRows[0])
      : null,
  };
}

function mapCatalogItem(input: unknown) {
  const row = object(input);
  const prices = Array.isArray(row.prices) ? row.prices.map(object) : [];
  const monthlyPrice =
    prices.find(
      (item) =>
        item.is_active !== false &&
        item.is_public !== false &&
        item.interval === "month",
    ) ??
    prices.find((item) => item.is_active !== false) ??
    {};
  const code = nullablePlan(row.code);
  if (!code) return null;

  return {
    code,
    currency: text(monthlyPrice.currency, "BRL"),
    description: text(row.description, ""),
    interval: billingInterval(monthlyPrice.interval),
    name: text(row.name, "Free"),
    unitAmountCents: number(monthlyPrice.unit_amount_cents),
  };
}

function mapSubscription(input: unknown) {
  const row = object(input);
  const metadata = object(row.metadata);
  const currentPlan = nullablePlan(row.plan_code);
  if (!currentPlan) throw new TherapistPlanQueryError("unavailable");
  const scheduledPlan = nullablePlan(metadata.scheduled_plan_code);

  return {
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    currentPeriodEnd: nullableText(row.current_period_end),
    plan: currentPlan,
    scheduledChangeAt:
      scheduledPlan === currentPlan
        ? null
        : nullableText(metadata.scheduled_plan_effective_at),
    scheduledPlan: scheduledPlan === currentPlan ? null : scheduledPlan,
    status: billingStatus(row.status),
  };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullablePlan(value: unknown): TherapistPlan | null {
  return value === "free" || value === "premium" || value === "premium_plus"
    ? value
    : null;
}

function assertCatalog(
  catalog: Array<{ code: TherapistPlan; unitAmountCents: number }>,
) {
  const byCode = new Map(catalog.map((item) => [item.code, item]));
  if (
    catalog.length !== 3 ||
    !byCode.has("free") ||
    !byCode.get("premium")?.unitAmountCents ||
    !byCode.get("premium_plus")?.unitAmountCents
  ) {
    throw new TherapistPlanQueryError("unavailable");
  }
}

function billingStatus(value: unknown): TherapistBillingStatus {
  const allowed = new Set([
    "active",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "past_due",
    "paused",
    "trialing",
    "unpaid",
  ]);
  return (
    allowed.has(String(value)) ? value : "incomplete"
  ) as TherapistBillingStatus;
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function billingInterval(value: unknown): "month" | "year" | null {
  return value === "month" || value === "year" ? value : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sortPlans(a: { code: TherapistPlan }, b: { code: TherapistPlan }) {
  const rank = { free: 0, premium: 1, premium_plus: 2 };
  return rank[a.code] - rank[b.code];
}
