import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { failure, success } from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
  getWebhookSecret,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import {
  eventCreatedAt,
  markWebhook,
  objectId,
  reserveWebhookEvent,
  sha256Hex,
} from "../_shared/payments/webhook-events.ts";
import {
  recordStripeSubscriptionInvoice,
  syncTherapistSubscriptionFromStripe,
} from "../_shared/payments/subscription-sync.ts";
import { normalizeStripeBillingWebhookError } from "./errors.ts";
import { ensureVideoSessionForPaidSessionPayment } from "./session-payment-side-effects.ts";
import {
  createPaymentIntentFinancialSnapshot,
  extractCheckoutFinancialSnapshot,
  type CheckoutFinancialSnapshot,
} from "../_shared/payments/checkout-financials.ts";

type FinancialStatus = "canceled" | "failed" | "paid" | "processing";

type StripePaymentReconciliation = {
  balanceTransactionId: string | null;
  feeAmountCents: number | null;
  netAmountCents: number | null;
  paymentMethodType: string | null;
  receiptUrl: string | null;
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

    if (!signature) {
      return new Response("Missing Stripe signature", { status: 400 });
    }

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      getWebhookSecret(runtime, "STRIPE_PLATFORM_WEBHOOK_SECRET"),
    );
    const eventTime = eventCreatedAt(event.created);
    const dataObject = event.data.object as unknown as Record<string, unknown>;
    const reservation = await reserveWebhookEvent(client, {
      accountId: event.account ?? null,
      apiVersion: event.api_version ?? null,
      eventCreatedAt: eventTime,
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      objectId: objectId(dataObject),
      payloadSha256: await sha256Hex(rawBody),
      source: event.account ? "connect" : "platform",
    });

    if (!reservation?.acquired) {
      return success({
        duplicate: true,
        status: reservation?.processing_status ?? "processing",
      });
    }

    try {
      const status = await handleEvent(
        client,
        stripe,
        event.type,
        dataObject,
        event.id,
        eventTime,
      );
      await markWebhook(client, event.id, status);
      return success({ received: true, status });
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
    const normalizedError = normalizeStripeBillingWebhookError(error);

    if (normalizedError !== error) {
      console.warn(
        JSON.stringify({
          code: "STRIPE_WEBHOOK_SIGNATURE_INVALID",
          message: error instanceof Error ? error.message.slice(0, 500) : null,
          request_id: requestId,
        }),
      );
    }

    return failure(normalizedError, requestId);
  }
});

async function handleEvent(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
  eventType: string,
  dataObject: Record<string, unknown>,
  eventId: string,
  eventTime: string,
): Promise<"ignored" | "processed"> {
  switch (eventType) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await handleCheckoutEvent(
        client,
        stripe,
        dataObject,
        eventType,
        eventId,
        eventTime,
      );
      return "processed";
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscriptionId = String(dataObject.id ?? "");
      if (!subscriptionId) return "ignored";
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const syncResult = await syncTherapistSubscriptionFromStripe(
        client,
        subscription as unknown as Record<string, unknown>,
        {
          environment: getPaymentsConfig(runtime).environment,
          eventId,
          eventTime,
        },
      );
      logSubscriptionSync({
        eventId,
        eventType,
        plan: syncResult.plan,
        status: syncResult.status,
        stripeSubscriptionId: syncResult.stripeSubscriptionId,
        therapistId: syncResult.therapistProfileId,
      });
      return "processed";
    }
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.payment_action_required":
    case "invoice.finalization_failed": {
      const invoiceId = String(dataObject.id ?? "");
      if (!invoiceId) return "ignored";
      const invoice = await stripe.invoices.retrieve(invoiceId);
      await recordStripeSubscriptionInvoice(
        client,
        invoice as unknown as Record<string, unknown>,
        eventType,
      );
      return "processed";
    }
    case "payment_intent.processing":
      await applyPaymentIntentState(
        client,
        stripe,
        dataObject,
        "processing",
        eventId,
        eventTime,
      );
      return "processed";
    case "payment_intent.requires_action":
      await applyPaymentIntentState(
        client,
        stripe,
        dataObject,
        "processing",
        eventId,
        eventTime,
      );
      return "processed";
    case "payment_intent.succeeded":
      await applyPaymentIntentState(
        client,
        stripe,
        dataObject,
        "paid",
        eventId,
        eventTime,
      );
      return "processed";
    case "payment_intent.payment_failed":
      await applyPaymentIntentState(
        client,
        stripe,
        dataObject,
        "failed",
        eventId,
        eventTime,
      );
      return "processed";
    case "payment_intent.canceled":
      await applyPaymentIntentState(
        client,
        stripe,
        dataObject,
        "canceled",
        eventId,
        eventTime,
      );
      return "processed";
    case "charge.refunded":
      await handleChargeRefunded(client, dataObject);
      return "processed";
    case "refund.created":
    case "refund.updated":
    case "refund.failed":
      await handleRefundEvent(
        client,
        dataObject,
        eventType,
        eventId,
        eventTime,
      );
      return "processed";
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
      await handleDispute(client, dataObject, eventType, eventId, eventTime);
      return "processed";
    case "transfer.updated":
    case "transfer.reversed":
      await handleTransferEvent(client, dataObject, eventTime);
      return "processed";
    default:
      return "ignored";
  }
}

async function handleCheckoutEvent(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
  session: Record<string, unknown>,
  eventType: string,
  eventId: string,
  eventTime: string,
) {
  if (
    session.mode === "subscription" &&
    typeof session.subscription === "string"
  ) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription,
    );
    const syncResult = await syncTherapistSubscriptionFromStripe(
      client,
      subscription as unknown as Record<string, unknown>,
      {
        checkoutSessionId: String(session.id),
        environment: getPaymentsConfig(runtime).environment,
        eventId,
        eventTime,
      },
    );
    logSubscriptionSync({
      checkoutSessionId: String(session.id),
      eventId,
      eventType,
      plan: syncResult.plan,
      status: syncResult.status,
      stripeSubscriptionId: syncResult.stripeSubscriptionId,
      therapistId: syncResult.therapistProfileId,
    });
    return;
  }

  const metadata = asRecord(session.metadata);
  if (metadata.payment_type !== "therapy_session") return;

  const sessionPaymentId = stringOrNull(metadata.tes_session_payment_id);
  if (!sessionPaymentId) return;

  if (
    eventType === "checkout.session.async_payment_failed" ||
    eventType === "checkout.session.expired"
  ) {
    await applySessionPaymentState(client, {
      checkoutSessionId: stringOrNull(session.id),
      eventId,
      eventTime,
      paymentIntentId: stringOrNull(session.payment_intent),
      sessionPaymentId,
      status: eventType === "checkout.session.expired" ? "canceled" : "failed",
    });
    return;
  }

  if (session.payment_status !== "paid") {
    await applySessionPaymentState(client, {
      checkoutSessionId: stringOrNull(session.id),
      eventId,
      eventTime,
      paymentIntentId: stringOrNull(session.payment_intent),
      sessionPaymentId,
      status: "processing",
    });
    return;
  }

  const paymentIntentId = stringOrNull(session.payment_intent);
  const financialSnapshot = await resolveCheckoutFinancialSnapshot(
    stripe,
    session,
  );
  const paymentIntent = paymentIntentId
    ? ((await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    })) as unknown as Record<string, unknown>)
    : null;
  const charge = asRecord(paymentIntent?.latest_charge);
  const chargeId = typeof paymentIntent?.latest_charge === "string"
    ? paymentIntent.latest_charge
    : stringOrNull(charge.id);

  await applySessionPaymentState(client, {
    chargeId,
    checkoutSessionId: stringOrNull(session.id),
    eventId,
    eventTime,
    financialSnapshot,
    paymentIntentId,
    reconciliation: chargeId ? extractChargeReconciliation(charge) : null,
    sessionPaymentId,
    status: "paid",
  });
}

async function applyPaymentIntentState(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
  paymentIntent: Record<string, unknown>,
  status: FinancialStatus,
  eventId: string,
  eventTime: string,
) {
  const metadata = asRecord(paymentIntent.metadata);
  const sessionPaymentId = stringOrNull(metadata.tes_session_payment_id);

  if (!sessionPaymentId) return;

  const chargeId = stringOrNull(paymentIntent.latest_charge);
  const reconciliation = status === "paid" && chargeId
    ? await retrieveChargeReconciliation(stripe, chargeId)
    : null;
  const resolvedCheckout = status === "paid"
    ? await resolvePaymentIntentFinancialSnapshot(client, stripe, paymentIntent)
    : { checkoutSessionId: null, financialSnapshot: null };

  await applySessionPaymentState(client, {
    chargeId,
    checkoutSessionId: resolvedCheckout.checkoutSessionId,
    eventId,
    eventTime,
    financialSnapshot: resolvedCheckout.financialSnapshot,
    paymentIntentId: stringOrNull(paymentIntent.id),
    reconciliation,
    sessionPaymentId,
    status,
  });
}

async function applySessionPaymentState(
  client: SupabaseRestClient,
  input: {
    chargeId?: string | null;
    checkoutSessionId?: string | null;
    eventId: string;
    eventTime: string;
    financialSnapshot?: CheckoutFinancialSnapshot | null;
    paymentIntentId?: string | null;
    reconciliation?: StripePaymentReconciliation | null;
    sessionPaymentId: string;
    status: FinancialStatus;
  },
) {
  if (input.status === "paid" && input.financialSnapshot) {
    const reconciliation = await client.rpc<{
      applied: boolean;
      reason?: string;
    }>(
      "reconcile_session_payment_amount_v1",
      {
        p_charged_amount_cents: input.financialSnapshot.chargedAmountCents,
        p_discount_amount_cents: input.financialSnapshot.discountAmountCents,
        p_metadata: input.financialSnapshot.metadata,
        p_original_amount_cents: input.financialSnapshot.originalAmountCents,
        p_session_payment_id: input.sessionPaymentId,
        p_stripe_checkout_session_id: input.checkoutSessionId ?? null,
      },
    );
    if (!reconciliation?.applied) {
      throw new Error(
        `stripe_amount_reconciliation_failed:${reconciliation?.reason ?? "unknown"}`,
      );
    }
  }

  await client.rpc("apply_session_payment_state_v1", {
    p_financial_status: input.status,
    p_session_payment_id: input.sessionPaymentId,
    p_stripe_charge_id: input.chargeId ?? null,
    p_stripe_checkout_session_id: input.checkoutSessionId ?? null,
    p_stripe_event_created_at: input.eventTime,
    p_stripe_event_id: input.eventId,
    p_stripe_payment_intent_id: input.paymentIntentId ?? null,
  });

  if (input.status !== "paid") return;

  if (input.chargeId || input.reconciliation) {
    await recordSessionPaymentReconciliation(client, {
      chargeId: input.chargeId ?? null,
      eventId: input.eventId,
      eventTime: input.eventTime,
      paymentMethodType: input.reconciliation?.paymentMethodType ?? null,
      receiptUrl: input.reconciliation?.receiptUrl ?? null,
      sessionPaymentId: input.sessionPaymentId,
      stripeBalanceTransactionId: input.reconciliation?.balanceTransactionId ?? null,
      stripeFeeAmountCents: input.reconciliation?.feeAmountCents ?? null,
      stripeNetAmountCents: input.reconciliation?.netAmountCents ?? null,
    });
  }

  const zoomEnvironment = getConfiguredZoomEnvironment();

  if (!zoomEnvironment) {
    console.warn(
      JSON.stringify({
        code: "VIDEO_SESSION_NOT_CREATED",
        message: "Zoom Video SDK environment is not configured for session payment.",
        sessionPaymentId: input.sessionPaymentId,
      }),
    );
    return;
  }

  await ensureVideoSessionForPaidSessionPayment(client, {
    sessionPaymentId: input.sessionPaymentId,
    source: "stripe-billing-webhook",
    zoomEnvironment,
  });
}

async function resolveCheckoutFinancialSnapshot(
  stripe: ReturnType<typeof createStripeClient>,
  session: Record<string, unknown>,
) {
  const checkoutSessionId = stringOrNull(session.id);
  const sessionWithAmounts = numberOrNull(session.amount_total) === null &&
      checkoutSessionId
    ? ((await stripe.checkout.sessions.retrieve(checkoutSessionId)) as unknown as
      Record<string, unknown>)
    : session;

  return extractCheckoutFinancialSnapshot(sessionWithAmounts);
}

async function resolvePaymentIntentFinancialSnapshot(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
  paymentIntent: Record<string, unknown>,
) {
  const paymentIntentId = stringOrNull(paymentIntent.id);
  const metadata = asRecord(paymentIntent.metadata);
  const sessionPaymentId = stringOrNull(metadata.tes_session_payment_id);
  const localPayment = sessionPaymentId
    ? await getSessionPaymentFinancialContext(client, sessionPaymentId)
    : null;
  let checkoutSessionId = localPayment?.stripeCheckoutSessionId ?? null;

  if (checkoutSessionId) {
    const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    const financialSnapshot = extractCheckoutFinancialSnapshot(
      checkout as unknown as Record<string, unknown>,
    );
    if (financialSnapshot) return { checkoutSessionId, financialSnapshot };
  }

  if (paymentIntentId) {
    const sessions = await stripe.checkout.sessions.list({
      limit: 1,
      payment_intent: paymentIntentId,
    });
    const checkout = sessions.data[0];
    if (checkout) {
      checkoutSessionId = checkout.id;
      const financialSnapshot = extractCheckoutFinancialSnapshot(
        checkout as unknown as Record<string, unknown>,
      );
      if (financialSnapshot) return { checkoutSessionId, financialSnapshot };
    }
  }

  const originalAmountCents = localPayment
    ? readOriginalAmountCents(localPayment.metadata) ??
      localPayment.grossAmountCents
    : numberOrNull(paymentIntent.amount);
  const financialSnapshot = createPaymentIntentFinancialSnapshot({
    amountReceivedCents: numberOrNull(paymentIntent.amount_received) ??
      numberOrNull(paymentIntent.amount),
    currency: stringOrNull(paymentIntent.currency),
    originalAmountCents: originalAmountCents ?? 0,
  });

  return { checkoutSessionId, financialSnapshot };
}

async function getSessionPaymentFinancialContext(
  client: SupabaseRestClient,
  sessionPaymentId: string,
) {
  const rows = await client.get<Array<{
    currency: string | null;
    gross_amount_cents: number;
    metadata: Record<string, unknown> | null;
    stripe_checkout_session_id: string | null;
  }>>(
    `/rest/v1/session_payments?select=gross_amount_cents,currency,metadata,stripe_checkout_session_id&id=eq.${encodeURIComponent(sessionPaymentId)}&limit=1`,
  );
  const payment = rows[0];
  if (!payment) return null;

  return {
    currency: payment.currency,
    grossAmountCents: payment.gross_amount_cents,
    metadata: payment.metadata ?? {},
    stripeCheckoutSessionId: payment.stripe_checkout_session_id,
  };
}

function readOriginalAmountCents(metadata: Record<string, unknown>) {
  const stripeCheckout = asRecord(metadata.stripe_checkout);
  return numberOrNull(stripeCheckout.original_amount_cents);
}

async function recordSessionPaymentReconciliation(
  client: SupabaseRestClient,
  input: {
    chargeId: string | null;
    eventId: string;
    eventTime: string;
    paymentMethodType: string | null;
    receiptUrl: string | null;
    sessionPaymentId: string;
    stripeBalanceTransactionId: string | null;
    stripeFeeAmountCents: number | null;
    stripeNetAmountCents: number | null;
  },
) {
  await client.rpc("record_session_payment_stripe_reconciliation_v1", {
    p_payment_method_type: input.paymentMethodType,
    p_payment_origin: "stripe_checkout",
    p_receipt_url: input.receiptUrl,
    p_session_payment_id: input.sessionPaymentId,
    p_stripe_balance_transaction_id: input.stripeBalanceTransactionId,
    p_stripe_charge_id: input.chargeId,
    p_stripe_event_created_at: input.eventTime,
    p_stripe_event_id: input.eventId,
    p_stripe_fee_amount_cents: input.stripeFeeAmountCents,
    p_stripe_net_amount_cents: input.stripeNetAmountCents,
  });
}

async function handleChargeRefunded(
  client: SupabaseRestClient,
  charge: Record<string, unknown>,
) {
  const paymentIntentId = stringOrNull(charge.payment_intent);
  if (!paymentIntentId) return;

  const rows = await client.get<Array<{ id: string }>>(
    `/rest/v1/session_payments?select=id&stripe_payment_intent_id=eq.${
      encodeURIComponent(
        paymentIntentId,
      )
    }&limit=1`,
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
      transfer_blocked_reason: "refund",
      transfer_status: "blocked",
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

async function handleRefundEvent(
  client: SupabaseRestClient,
  refund: Record<string, unknown>,
  eventType: string,
  eventId: string,
  eventTime: string,
) {
  const refundId = stringOrNull(refund.id);
  const paymentIntentId = stringOrNull(refund.payment_intent);
  const chargeId = stringOrNull(refund.charge);

  if (!refundId || (!paymentIntentId && !chargeId)) return;

  const filter = paymentIntentId
    ? `stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}`
    : `stripe_charge_id=eq.${encodeURIComponent(chargeId ?? "")}`;
  const [payment] = await client.get<
    Array<{ gross_amount_cents: number; id: string }>
  >(`/rest/v1/session_payments?select=id,gross_amount_cents&${filter}&limit=1`);

  if (!payment) return;

  const amountCents = numberOrZero(refund.amount);
  const refundStatus = eventType === "refund.failed"
    ? "failed"
    : String(refund.status ?? "pending");

  await client.post(
    "/rest/v1/session_refunds?on_conflict=stripe_refund_id",
    {
      amount_cents: amountCents,
      currency: String(refund.currency ?? "brl").toUpperCase(),
      metadata: { eventType },
      processed_at: refundStatus === "succeeded" ? eventTime : null,
      reason: stringOrNull(refund.reason),
      session_payment_id: payment.id,
      status: refundStatus,
      stripe_refund_id: refundId,
      updated_at: new Date().toISOString(),
    },
    "resolution=merge-duplicates,return=minimal",
  );

  if (refundStatus !== "succeeded") return;

  const successfulRefunds = await client.get<Array<{ amount_cents: number }>>(
    `/rest/v1/session_refunds?select=amount_cents&session_payment_id=eq.${
      encodeURIComponent(
        payment.id,
      )
    }&status=eq.succeeded`,
  );
  const totalRefundedCents = successfulRefunds.reduce(
    (total, row) => total + row.amount_cents,
    0,
  );

  await client.patch(
    `/rest/v1/session_payments?id=eq.${encodeURIComponent(payment.id)}`,
    {
      financial_status: totalRefundedCents >= payment.gross_amount_cents
        ? "refunded"
        : "partially_refunded",
      refund_pending: false,
      transfer_blocked_reason: "refund",
      transfer_status: "blocked",
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
  await client.post(
    "/rest/v1/financial_ledger_entries?on_conflict=entry_type,source_table,source_external_id,direction",
    {
      amount_cents: amountCents,
      direction: "debit",
      entry_type: "refund",
      occurred_at: eventTime,
      session_payment_id: payment.id,
      source_external_id: refundId,
      source_table: "stripe_refunds",
      stripe_event_id: eventId,
    },
    "resolution=ignore-duplicates,return=minimal",
  );
}

async function handleDispute(
  client: SupabaseRestClient,
  dispute: Record<string, unknown>,
  eventType: string,
  eventId: string,
  eventTime: string,
) {
  const chargeId = stringOrNull(dispute.charge);
  if (!chargeId) return;

  const rows = await client.get<
    Array<{ id: string; financial_status: string }>
  >(
    `/rest/v1/session_payments?select=id,financial_status&stripe_charge_id=eq.${
      encodeURIComponent(chargeId)
    }&limit=1`,
  );
  const payment = rows[0];
  if (!payment) return;

  await client.post(
    "/rest/v1/session_disputes?on_conflict=stripe_dispute_id",
    {
      amount_cents: numberOrZero(dispute.amount),
      closed_at: eventType === "charge.dispute.closed" ? eventTime : null,
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
  const disputeId = String(dispute.id);
  const disputeStatus = String(dispute.status ?? "unknown");
  const disputeAmount = numberOrZero(dispute.amount);

  if (eventType === "charge.dispute.created") {
    await client.post(
      "/rest/v1/financial_ledger_entries?on_conflict=entry_type,source_table,source_external_id,direction",
      {
        amount_cents: disputeAmount,
        direction: "debit",
        entry_type: "dispute",
        occurred_at: eventTime,
        session_payment_id: payment.id,
        source_external_id: disputeId,
        source_table: "stripe_disputes",
        stripe_event_id: eventId,
      },
      "resolution=ignore-duplicates,return=minimal",
    );
  }

  if (eventType === "charge.dispute.closed" && disputeStatus === "won") {
    await client.patch(
      `/rest/v1/session_payments?id=eq.${encodeURIComponent(payment.id)}`,
      {
        disputed_at: null,
        financial_status: payment.financial_status === "partially_refunded"
          ? "partially_refunded"
          : "paid",
        transfer_blocked_reason: null,
        updated_at: new Date().toISOString(),
      },
      "return=minimal",
    );
    await client.post(
      "/rest/v1/financial_ledger_entries?on_conflict=entry_type,source_table,source_external_id,direction",
      {
        amount_cents: disputeAmount,
        direction: "credit",
        entry_type: "recovery",
        occurred_at: eventTime,
        session_payment_id: payment.id,
        source_external_id: disputeId,
        source_table: "stripe_disputes",
        stripe_event_id: eventId,
      },
      "resolution=ignore-duplicates,return=minimal",
    );
    await client.rpc("refresh_session_transfer_eligibility", {
      p_session_payment_id: payment.id,
    });
    return;
  }

  await client.patch(
    `/rest/v1/session_payments?id=eq.${encodeURIComponent(payment.id)}`,
    {
      disputed_at: eventTime,
      financial_status: "disputed",
      transfer_blocked_reason: "disputed",
      transfer_status: "blocked",
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

async function handleTransferEvent(
  client: SupabaseRestClient,
  transfer: Record<string, unknown>,
  eventTime: string,
) {
  const transferId = stringOrNull(transfer.id);
  if (!transferId) return;

  const [localTransfer] = await client.get<
    Array<{ id: string; session_payment_id: string }>
  >(
    `/rest/v1/stripe_transfers?select=id,session_payment_id&stripe_transfer_id=eq.${
      encodeURIComponent(
        transferId,
      )
    }&limit=1`,
  );

  if (!localTransfer) return;

  if (transfer.reversed !== true) {
    await client.patch(
      `/rest/v1/stripe_transfers?id=eq.${encodeURIComponent(localTransfer.id)}`,
      { status: "transferred", transferred_at: eventTime },
      "return=minimal",
    );
    return;
  }

  const reversedAmount = numberOrZero(
    transfer.amount_reversed ?? transfer.amount,
  );
  await client.patch(
    `/rest/v1/stripe_transfers?id=eq.${encodeURIComponent(localTransfer.id)}`,
    { status: "reversed" },
    "return=minimal",
  );
  await client.patch(
    `/rest/v1/session_payments?id=eq.${
      encodeURIComponent(
        localTransfer.session_payment_id,
      )
    }`,
    {
      transfer_blocked_reason: "transfer_reversed",
      transfer_status: "reversed",
    },
    "return=minimal",
  );
  await client.post(
    "/rest/v1/financial_ledger_entries?on_conflict=entry_type,source_table,source_external_id,direction",
    {
      amount_cents: reversedAmount,
      direction: "credit",
      entry_type: "transfer_reversal",
      occurred_at: eventTime,
      session_payment_id: localTransfer.session_payment_id,
      source_external_id: transferId,
      source_table: "stripe_transfers",
      stripe_transfer_id: localTransfer.id,
    },
    "resolution=ignore-duplicates,return=minimal",
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unixToIso(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" ? value : 0;
}

async function retrieveChargeReconciliation(
  stripe: ReturnType<typeof createStripeClient>,
  chargeId: string,
): Promise<StripePaymentReconciliation> {
  const charge = (await stripe.charges.retrieve(chargeId, {
    expand: ["balance_transaction"],
  })) as unknown as Record<string, unknown>;

  return extractChargeReconciliation(charge);
}

function extractChargeReconciliation(
  charge: Record<string, unknown>,
): StripePaymentReconciliation {
  const balanceTransaction = asRecord(charge.balance_transaction);
  const paymentMethodDetails = asRecord(charge.payment_method_details);

  return {
    balanceTransactionId: stringOrNull(balanceTransaction.id),
    feeAmountCents: numberOrNull(balanceTransaction.fee),
    netAmountCents: numberOrNull(balanceTransaction.net),
    paymentMethodType: stringOrNull(paymentMethodDetails.type),
    receiptUrl: stringOrNull(charge.receipt_url),
  };
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

function logSubscriptionSync(input: {
  checkoutSessionId?: string;
  eventId: string;
  eventType: string;
  plan: string;
  status: string;
  stripeSubscriptionId: string;
  therapistId: string;
}) {
  console.log(
    JSON.stringify({
      checkoutSessionId: input.checkoutSessionId ?? null,
      code: "SUBSCRIPTION_WEBHOOK_SYNCED",
      operation: "stripe_billing_webhook_subscription_sync",
      plan: input.plan,
      statusNew: input.status,
      stripeEventId: input.eventId,
      stripeEventType: input.eventType,
      stripeSubscriptionId: input.stripeSubscriptionId,
      therapistId: input.therapistId,
    }),
  );
}

function getConfiguredZoomEnvironment() {
  const value = runtime.env.get("ZOOM_ENVIRONMENT")?.trim().toLowerCase();

  if (value === "development" || value === "production") return value;

  return null;
}

export {};
