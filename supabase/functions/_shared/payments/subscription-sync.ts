import { SupabaseRestClient } from "../auth/supabase-rest.ts";
import {
  getStripeInvoiceSubscriptionId,
  getStripeSubscriptionPeriod,
} from "./stripe-subscription.ts";

export type TherapistPlan = "premium" | "premium_plus";

export type CheckoutStatus =
  | "active"
  | "canceled"
  | "expired"
  | "failed"
  | "pending"
  | "requires_action";

export type SubscriptionSyncResult = {
  applied?: boolean;
  localPlan?: "free" | TherapistPlan;
  plan: TherapistPlan;
  status: string;
  stripeSubscriptionId: string;
  therapistProfileId: string;
};

export const PLAN_ACTIVE_STATUSES = new Set(["active", "past_due", "trialing"]);

export const CHECKOUT_BLOCKING_LOCAL_STATUSES = [
  "active",
  "past_due",
  "trialing",
  "unpaid",
] as const;

export async function syncTherapistSubscriptionFromStripe(
  client: SupabaseRestClient,
  subscription: Record<string, unknown>,
  input: {
    checkoutSessionId?: string | null;
    environment: string;
    eventId: string;
    eventTime: string;
    expectedTherapistProfileId?: string | null;
  },
): Promise<SubscriptionSyncResult> {
  const metadata = asRecord(subscription.metadata);
  const identity = getSubscriptionIdentity(metadata);
  const therapistProfileId = identity.therapistProfileId;
  const priceId = getSubscriptionPriceId(subscription);
  const { currentPeriodEnd, currentPeriodStart } =
    getStripeSubscriptionPeriod(subscription);

  if (!therapistProfileId || !priceId) {
    throw new Error("STRIPE_SUBSCRIPTION_IDENTITY_OR_PRICE_MISSING");
  }

  if (
    input.expectedTherapistProfileId &&
    therapistProfileId !== input.expectedTherapistProfileId
  ) {
    throw new Error("STRIPE_SUBSCRIPTION_THERAPIST_MISMATCH");
  }

  const [price] = await client.get<
    Array<{
      billing_plans: { code: TherapistPlan } | null;
      id: string;
      plan_id: string;
    }>
  >(
    `/rest/v1/billing_plan_prices?select=id,plan_id,billing_plans!inner(code)&stripe_price_id=eq.${encodeURIComponent(
      priceId,
    )}&is_active=eq.true&limit=1`,
  );
  const planCode = normalizePlan(price?.billing_plans?.code);

  if (!price || !planCode) {
    throw new Error("STRIPE_SUBSCRIPTION_PRICE_NOT_MAPPED");
  }

  const customerId = stringOrNull(subscription.customer);
  const localCustomer = customerId
    ? await client.get<
        Array<{
          id: string;
          profile_id: string;
          role: string;
          therapist_profile_id: string | null;
        }>
      >(
        `/rest/v1/stripe_customers?select=id,profile_id,role,therapist_profile_id&stripe_customer_id=eq.${encodeURIComponent(
          customerId,
        )}&environment=eq.${encodeURIComponent(input.environment)}&limit=1`,
      )
    : [];

  if (
    localCustomer[0] &&
    (localCustomer[0].role !== "therapist" ||
      localCustomer[0].therapist_profile_id !== therapistProfileId)
  ) {
    throw new Error("STRIPE_SUBSCRIPTION_CUSTOMER_MISMATCH");
  }

  const rpcResult = await client.rpc<
    | { applied?: boolean; plan?: string }
    | Array<{ applied?: boolean; plan?: string }>
  >("apply_therapist_subscription_event_v1", {
    p_billing_plan_id: price.plan_id,
    p_billing_plan_price_id: price.id,
    p_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    p_canceled_at: unixToIso(subscription.canceled_at),
    p_current_period_end: unixToIso(currentPeriodEnd),
    p_current_period_start: unixToIso(currentPeriodStart),
    p_ended_at: unixToIso(subscription.ended_at),
    p_metadata: metadata,
    p_plan_code: planCode,
    p_status: normalizeSubscriptionStatus(subscription.status),
    p_stripe_checkout_session_id: input.checkoutSessionId ?? null,
    p_stripe_customer_id: localCustomer[0]?.id ?? null,
    p_stripe_event_created_at: input.eventTime,
    p_stripe_event_id: input.eventId,
    p_stripe_latest_invoice_id: stringOrNull(subscription.latest_invoice),
    p_stripe_subscription_id: String(subscription.id),
    p_therapist_profile_id: therapistProfileId,
  });

  const rpcPayload = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

  return {
    applied: rpcPayload?.applied,
    localPlan: normalizeLocalPlan(rpcPayload?.plan),
    plan: planCode,
    status: normalizeSubscriptionStatus(subscription.status),
    stripeSubscriptionId: String(subscription.id),
    therapistProfileId,
  };
}

export async function recordStripeSubscriptionInvoice(
  client: SupabaseRestClient,
  invoice: Record<string, unknown>,
  eventType: string,
) {
  const subscriptionId = getStripeInvoiceSubscriptionId(invoice);
  const customerId = stringOrNull(invoice.customer);
  const subscriptionRows = subscriptionId
    ? await client.get<Array<{ id: string; therapist_profile_id: string }>>(
        `/rest/v1/therapist_subscriptions?select=id,therapist_profile_id&stripe_subscription_id=eq.${encodeURIComponent(
          subscriptionId,
        )}&limit=1`,
      )
    : [];

  await client.post(
    "/rest/v1/billing_invoices?on_conflict=stripe_invoice_id",
    {
      amount_due_cents: numberOrZero(invoice.amount_due),
      amount_paid_cents: numberOrZero(invoice.amount_paid),
      currency: String(invoice.currency ?? "brl").toUpperCase(),
      due_at: unixToIso(invoice.due_date),
      hosted_invoice_url: stringOrNull(invoice.hosted_invoice_url),
      invoice_pdf: stringOrNull(invoice.invoice_pdf),
      metadata: { eventType },
      paid_at: unixToIso(asRecord(invoice.status_transitions).paid_at),
      status: String(invoice.status ?? "unknown"),
      stripe_customer_id: customerId,
      stripe_invoice_id: String(invoice.id),
      stripe_subscription_id: subscriptionId,
      therapist_profile_id: subscriptionRows[0]?.therapist_profile_id ?? null,
      therapist_subscription_id: subscriptionRows[0]?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    "resolution=merge-duplicates,return=minimal",
  );
}

export function resolveCheckoutStatus(input: {
  checkoutPaymentStatus?: unknown;
  checkoutStatus?: unknown;
  subscriptionStatus?: unknown;
}): CheckoutStatus {
  const checkoutStatus = String(input.checkoutStatus ?? "");
  const paymentStatus = String(input.checkoutPaymentStatus ?? "");
  const subscriptionStatus = normalizeSubscriptionStatus(
    input.subscriptionStatus,
  );

  if (
    PLAN_ACTIVE_STATUSES.has(subscriptionStatus) &&
    paymentStatus === "paid"
  ) {
    return "active";
  }

  if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
    return "requires_action";
  }

  if (subscriptionStatus === "canceled" || checkoutStatus === "complete") {
    return paymentStatus === "paid" ? "pending" : "failed";
  }

  if (
    checkoutStatus === "expired" ||
    subscriptionStatus === "incomplete_expired"
  ) {
    return "expired";
  }

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "active";
  }

  return "pending";
}

export function getSubscriptionIdentity(metadata: Record<string, unknown>) {
  return {
    therapistProfileId:
      stringOrNull(metadata.therapist_profile_id) ??
      stringOrNull(metadata.tes_therapist_id),
    therapistUserId:
      stringOrNull(metadata.therapist_user_id) ??
      stringOrNull(metadata.user_id),
  };
}

export function getSubscriptionPriceId(subscription: Record<string, unknown>) {
  const items = asRecord(subscription.items);
  const data = Array.isArray(items.data) ? items.data : [];
  const firstItem = asRecord(data[0]);
  const price = asRecord(firstItem.price);

  return stringOrNull(price.id);
}

export function normalizeSubscriptionStatus(value: unknown) {
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
  const status = String(value ?? "incomplete");

  return allowed.has(status) ? status : "incomplete";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePlan(value: unknown): TherapistPlan | null {
  return value === "premium" || value === "premium_plus" ? value : null;
}

function normalizeLocalPlan(
  value: unknown,
): "free" | TherapistPlan | undefined {
  return value === "free" || value === "premium" || value === "premium_plus"
    ? value
    : undefined;
}

function unixToIso(value: unknown) {
  return typeof value === "number"
    ? new Date(value * 1000).toISOString()
    : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" ? value : 0;
}
