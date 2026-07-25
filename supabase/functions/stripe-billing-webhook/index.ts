import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { failure, success } from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
  getWebhookSecret,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type WebhookEventRow = {
  id: string;
  processing_status:
    | "failed"
    | "ignored"
    | "processed"
    | "processing"
    | "received";
};

const runtime = getPaymentsRuntime("stripe-billing-webhook");

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const config = getPaymentsConfig(runtime);
    const stripe = createStripeClient(config.stripeApiKey);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const signature = request.headers.get("stripe-signature");
    const rawBody = await request.text();
    const webhookSecret = getWebhookSecret(
      runtime,
      "STRIPE_PLATFORM_WEBHOOK_SECRET",
    );

    if (!signature) {
      return new Response("Missing Stripe signature", { status: 400 });
    }

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
    const webhookRow = await reserveWebhookEvent(client, {
      accountId: event.account ?? null,
      apiVersion: event.api_version ?? null,
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      payloadSha256: await sha256Hex(rawBody),
      source: event.account ? "connect" : "platform",
    });

    if (webhookRow.processing_status === "processed") {
      return success({ duplicate: true });
    }

    await markWebhook(client, event.id, "processing");

    try {
      await handleEvent(client, stripe, event);
      await markWebhook(client, event.id, "processed");
      return success({ received: true });
    } catch (error) {
      await markWebhook(
        client,
        event.id,
        "failed",
        error instanceof Error ? error.message : "UNKNOWN",
      );
      throw error;
    }
  } catch (error) {
    return failure(error, requestId);
  }
});

async function handleEvent(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
  event: Awaited<
    ReturnType<
      ReturnType<typeof createStripeClient>["webhooks"]["constructEventAsync"]
    >
  >,
) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        client,
        stripe,
        event.data.object as unknown as Record<string, unknown>,
      );
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(
        client,
        event.data.object as unknown as Record<string, unknown>,
      );
      break;
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.payment_action_required":
      await syncInvoice(
        client,
        event.data.object as unknown as Record<string, unknown>,
        event.type,
      );
      break;
    case "payment_intent.succeeded":
      await markSessionPaymentPaid(
        client,
        event.data.object as unknown as Record<string, unknown>,
      );
      break;
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      await markSessionPaymentFailed(
        client,
        event.data.object as unknown as Record<string, unknown>,
        event.type,
      );
      break;
    case "charge.refunded":
      await handleChargeRefunded(
        client,
        event.data.object as unknown as Record<string, unknown>,
      );
      break;
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
      await handleDispute(
        client,
        event.data.object as unknown as Record<string, unknown>,
        event.type,
      );
      break;
    default:
      await markWebhook(client, event.id, "ignored");
  }
}

async function handleCheckoutCompleted(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
  session: Record<string, unknown>,
) {
  if (
    session.mode === "subscription" &&
    typeof session.subscription === "string"
  ) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription,
    );
    await syncSubscription(
      client,
      subscription as unknown as Record<string, unknown>,
      String(session.id),
    );
    return;
  }

  const metadata = asRecord(session.metadata);

  if (metadata.payment_type === "therapy_session") {
    await markSessionPaymentPaid(client, {
      id: session.payment_intent,
      metadata,
    });
  }
}

async function syncSubscription(
  client: SupabaseRestClient,
  subscription: Record<string, unknown>,
  checkoutSessionId?: string,
) {
  const metadata = asRecord(subscription.metadata);
  const therapistId =
    typeof metadata.tes_therapist_id === "string"
      ? metadata.tes_therapist_id
      : null;
  const planCode = normalizePlan(metadata.plan_code);

  if (!therapistId || !planCode) return;

  const status = normalizeSubscriptionStatus(subscription.status);
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : null;
  const localCustomer = customerId
    ? await client.get<Array<{ id: string }>>(
        `/rest/v1/stripe_customers?select=id&stripe_customer_id=eq.${encodeURIComponent(
          customerId,
        )}&limit=1`,
      )
    : [];
  const [plan] = await client.get<Array<{ id: string }>>(
    `/rest/v1/billing_plans?select=id&code=eq.${planCode}&limit=1`,
  );
  const [price] = await client.get<Array<{ id: string }>>(
    `/rest/v1/billing_plan_prices?select=id&billing_plans.code=eq.${planCode}&billing_plans!inner(code)&is_active=eq.true&limit=1`,
  );

  await client.post(
    "/rest/v1/therapist_subscriptions?on_conflict=stripe_subscription_id",
    {
      billing_plan_id: plan?.id ?? null,
      billing_plan_price_id: price?.id ?? null,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      canceled_at: unixToIso(subscription.canceled_at),
      current_period_end: unixToIso(subscription.current_period_end),
      current_period_start: unixToIso(subscription.current_period_start),
      ended_at: unixToIso(subscription.ended_at),
      metadata,
      plan_code: planCode,
      status,
      stripe_checkout_session_id: checkoutSessionId ?? null,
      stripe_customer_id: localCustomer[0]?.id ?? null,
      stripe_latest_invoice_id: stringOrNull(subscription.latest_invoice),
      stripe_subscription_id: String(subscription.id),
      therapist_profile_id: therapistId,
      updated_at: new Date().toISOString(),
    },
    "resolution=merge-duplicates,return=minimal",
  );

  const activePlan =
    status === "active" || status === "trialing" || status === "past_due"
      ? planCode
      : "free";

  await client.patch(
    `/rest/v1/therapist_profiles?id=eq.${encodeURIComponent(therapistId)}`,
    { plan: activePlan },
    "return=minimal",
  );
}

async function syncInvoice(
  client: SupabaseRestClient,
  invoice: Record<string, unknown>,
  eventType: string,
) {
  const subscriptionId = stringOrNull(invoice.subscription);
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
      paid_at: eventType === "invoice.paid" ? new Date().toISOString() : null,
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

async function markSessionPaymentPaid(
  client: SupabaseRestClient,
  paymentIntent: Record<string, unknown>,
) {
  const metadata = asRecord(paymentIntent.metadata);
  const sessionPaymentId =
    typeof metadata.tes_session_payment_id === "string"
      ? metadata.tes_session_payment_id
      : null;
  const bookingId =
    typeof metadata.tes_session_id === "string"
      ? metadata.tes_session_id
      : null;
  const query = sessionPaymentId
    ? `id=eq.${encodeURIComponent(sessionPaymentId)}`
    : `booking_id=eq.${encodeURIComponent(bookingId ?? "")}`;
  const rows = await client.get<
    Array<{
      booking_id: string;
      gross_amount_cents: number;
      id: string;
      patient_profile_id: string;
      platform_gross_commission_cents: number;
      therapist_amount_cents: number;
      therapist_profile_id: string;
    }>
  >(`/rest/v1/session_payments?select=*&${query}&limit=1`);
  const payment = rows[0];

  if (!payment) return;

  await client.patch(
    `/rest/v1/session_payments?id=eq.${encodeURIComponent(payment.id)}`,
    {
      financial_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_charge_id: stringOrNull(paymentIntent.latest_charge),
      stripe_payment_intent_id: String(paymentIntent.id),
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
  await client.patch(
    `/rest/v1/bookings?id=eq.${encodeURIComponent(payment.booking_id)}`,
    { payment_status: "paid", status: "confirmed" },
    "return=minimal",
  );
  await client.patch(
    `/rest/v1/payments?booking_id=eq.${encodeURIComponent(payment.booking_id)}`,
    { paid_at: new Date().toISOString(), status: "paid" },
    "return=minimal",
  );
  await insertLedgerForPaidSession(client, payment);
  await client.rpc("refresh_session_transfer_eligibility", {
    p_session_payment_id: payment.id,
  });
}

async function markSessionPaymentFailed(
  client: SupabaseRestClient,
  paymentIntent: Record<string, unknown>,
  eventType: string,
) {
  const metadata = asRecord(paymentIntent.metadata);
  const sessionPaymentId =
    typeof metadata.tes_session_payment_id === "string"
      ? metadata.tes_session_payment_id
      : null;

  if (!sessionPaymentId) return;

  await client.patch(
    `/rest/v1/session_payments?id=eq.${encodeURIComponent(sessionPaymentId)}`,
    {
      canceled_at:
        eventType === "payment_intent.canceled"
          ? new Date().toISOString()
          : null,
      failed_at:
        eventType !== "payment_intent.canceled"
          ? new Date().toISOString()
          : null,
      financial_status:
        eventType === "payment_intent.canceled" ? "canceled" : "failed",
      stripe_payment_intent_id: String(paymentIntent.id),
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

async function handleChargeRefunded(
  client: SupabaseRestClient,
  charge: Record<string, unknown>,
) {
  const paymentIntentId = stringOrNull(charge.payment_intent);

  if (!paymentIntentId) return;

  const rows = await client.get<Array<{ id: string }>>(
    `/rest/v1/session_payments?select=id&stripe_payment_intent_id=eq.${encodeURIComponent(
      paymentIntentId,
    )}&limit=1`,
  );

  if (!rows[0]) return;

  await client.patch(
    `/rest/v1/session_payments?id=eq.${encodeURIComponent(rows[0].id)}`,
    {
      financial_status:
        numberOrZero(charge.amount_refunded) >= numberOrZero(charge.amount)
          ? "refunded"
          : "partially_refunded",
      refund_pending: false,
      transfer_status: "blocked",
      transfer_blocked_reason: "refund",
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

async function handleDispute(
  client: SupabaseRestClient,
  dispute: Record<string, unknown>,
  eventType: string,
) {
  const chargeId = stringOrNull(dispute.charge);

  if (!chargeId) return;

  const rows = await client.get<Array<{ id: string }>>(
    `/rest/v1/session_payments?select=id&stripe_charge_id=eq.${encodeURIComponent(chargeId)}&limit=1`,
  );
  const payment = rows[0];

  if (!payment) return;

  await client.post(
    "/rest/v1/session_disputes?on_conflict=stripe_dispute_id",
    {
      amount_cents: numberOrZero(dispute.amount),
      closed_at:
        eventType === "charge.dispute.closed" ? new Date().toISOString() : null,
      currency: String(dispute.currency ?? "brl").toUpperCase(),
      evidence_due_by: unixToIso(asRecord(dispute.evidence_details).due_by),
      metadata: { eventType },
      session_payment_id: payment.id,
      status: String(dispute.status ?? "unknown"),
      stripe_charge_id: chargeId,
      stripe_dispute_id: String(dispute.id),
      updated_at: new Date().toISOString(),
    },
    "resolution=merge-duplicates,return=minimal",
  );
  await client.patch(
    `/rest/v1/session_payments?id=eq.${encodeURIComponent(payment.id)}`,
    {
      disputed_at: new Date().toISOString(),
      financial_status: "disputed",
      transfer_status: "blocked",
      transfer_blocked_reason: "disputed",
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

async function insertLedgerForPaidSession(
  client: SupabaseRestClient,
  payment: {
    booking_id: string;
    gross_amount_cents: number;
    id: string;
    patient_profile_id: string;
    platform_gross_commission_cents: number;
    therapist_amount_cents: number;
    therapist_profile_id: string;
  },
) {
  const entries = [
    {
      amount_cents: payment.gross_amount_cents,
      booking_id: payment.booking_id,
      direction: "credit",
      entry_type: "session_gross_payment",
      patient_profile_id: payment.patient_profile_id,
      session_payment_id: payment.id,
      source_id: payment.id,
      source_table: "session_payments",
      therapist_profile_id: payment.therapist_profile_id,
    },
    {
      amount_cents: payment.therapist_amount_cents,
      booking_id: payment.booking_id,
      direction: "credit",
      entry_type: "therapist_payable",
      patient_profile_id: payment.patient_profile_id,
      session_payment_id: payment.id,
      source_id: payment.id,
      source_table: "session_payments",
      therapist_profile_id: payment.therapist_profile_id,
    },
    {
      amount_cents: payment.platform_gross_commission_cents,
      booking_id: payment.booking_id,
      direction: "credit",
      entry_type: "platform_gross_commission",
      patient_profile_id: payment.patient_profile_id,
      session_payment_id: payment.id,
      source_id: payment.id,
      source_table: "session_payments",
      therapist_profile_id: payment.therapist_profile_id,
    },
  ].filter((entry) => entry.amount_cents > 0);

  for (const entry of entries) {
    await client.post(
      "/rest/v1/financial_ledger_entries?on_conflict=entry_type,source_table,source_id,direction",
      entry,
      "resolution=ignore-duplicates,return=minimal",
    );
  }
}

async function reserveWebhookEvent(
  client: SupabaseRestClient,
  input: {
    accountId: string | null;
    apiVersion: string | null;
    eventId: string;
    eventType: string;
    livemode: boolean;
    payloadSha256: string;
    source: string;
  },
) {
  const existing = await client.get<WebhookEventRow[]>(
    `/rest/v1/stripe_webhook_events?select=id,processing_status&stripe_event_id=eq.${encodeURIComponent(
      input.eventId,
    )}&limit=1`,
  );

  if (existing[0]) return existing[0];

  const rows = await client.post<WebhookEventRow[]>(
    "/rest/v1/stripe_webhook_events?select=id,processing_status",
    {
      account_id: input.accountId,
      api_version: input.apiVersion,
      attempts: 1,
      event_type: input.eventType,
      livemode: input.livemode,
      payload_sha256: input.payloadSha256,
      processing_status: "received",
      source: input.source,
      stripe_event_id: input.eventId,
      updated_at: new Date().toISOString(),
    },
    "return=representation",
  );

  return rows[0];
}

async function markWebhook(
  client: SupabaseRestClient,
  eventId: string,
  status: "failed" | "ignored" | "processed" | "processing",
  errorMessage?: string,
) {
  await client.patch(
    `/rest/v1/stripe_webhook_events?stripe_event_id=eq.${encodeURIComponent(eventId)}`,
    {
      error_message: errorMessage?.slice(0, 500) ?? null,
      processed_at:
        status === "processed" || status === "ignored"
          ? new Date().toISOString()
          : null,
      processing_started_at:
        status === "processing" ? new Date().toISOString() : undefined,
      processing_status: status,
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePlan(value: unknown) {
  return value === "premium" || value === "premium_plus" ? value : null;
}

function normalizeSubscriptionStatus(value: unknown) {
  const allowed = new Set([
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ]);
  const status = String(value ?? "incomplete");

  return allowed.has(status) ? status : "incomplete";
}

function unixToIso(value: unknown) {
  return typeof value === "number"
    ? new Date(value * 1000).toISOString()
    : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" ? value : 0;
}

export {};
