import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

const runtime = getPaymentsRuntime("reconcile-stripe-transfers");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    await requireInternalOperationsAccess(
      runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN"),
      request,
    );
    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const paymentRows = await client.get<
      Array<{
        id: string;
        stripe_payment_intent_id: string;
        transfer_blocked_reason: string | null;
      }>
    >(
      "/rest/v1/session_payments?select=id,stripe_payment_intent_id,transfer_blocked_reason&financial_status=eq.paid&stripe_payment_intent_id=not.is.null&stripe_charge_id=is.null&limit=50",
    );
    const paymentsReconciled = [];

    for (const payment of paymentRows) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        payment.stripe_payment_intent_id,
        { expand: ["latest_charge.balance_transaction"] },
      );
      const latestCharge = asRecord(paymentIntent.latest_charge);
      const chargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : stringOrNull(latestCharge.id);

      if (paymentIntent.status !== "succeeded" || !chargeId) {
        paymentsReconciled.push({
          paymentId: payment.id,
          reconciled: false,
          status: paymentIntent.status,
        });
        continue;
      }

      const balanceTransaction = asRecord(latestCharge.balance_transaction);
      await client.patch(
        `/rest/v1/session_payments?id=eq.${encodeURIComponent(payment.id)}`,
        {
          stripe_balance_transaction_id: stringOrNull(balanceTransaction.id),
          stripe_charge_id: chargeId,
          stripe_fee_amount_cents: numberOrNull(balanceTransaction.fee),
          stripe_net_amount_cents: numberOrNull(balanceTransaction.net),
          transfer_blocked_reason:
            payment.transfer_blocked_reason ===
            "source_charge_reconciliation_required"
              ? null
              : payment.transfer_blocked_reason,
          transfer_status:
            payment.transfer_blocked_reason ===
            "source_charge_reconciliation_required"
              ? "waiting_confirmation"
              : undefined,
        },
        "return=minimal",
      );
      await client.rpc("refresh_session_transfer_eligibility", {
        p_session_payment_id: payment.id,
      });
      paymentsReconciled.push({
        chargeId,
        paymentId: payment.id,
        reconciled: true,
      });
    }

    const rows = await client.get<
      Array<{ id: string; stripe_transfer_id: string }>
    >(
      "/rest/v1/stripe_transfers?select=id,stripe_transfer_id&stripe_transfer_id=not.is.null&status=in.(pending,failed)&limit=50",
    );
    const transfersReconciled = [];

    for (const row of rows) {
      const transfer = await stripe.transfers.retrieve(row.stripe_transfer_id);
      const status = transfer.reversed ? "reversed" : "transferred";

      await client.patch(
        `/rest/v1/stripe_transfers?id=eq.${encodeURIComponent(row.id)}`,
        {
          status,
          transferred_at:
            status === "transferred" ? new Date().toISOString() : null,
        },
        "return=minimal",
      );
      transfersReconciled.push({ status, transferId: row.stripe_transfer_id });
    }

    return success({ paymentsReconciled, transfersReconciled });
  } catch (error) {
    return failure(error, requestId);
  }
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

export {};
