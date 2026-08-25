import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { DomainError, failure, requireInternalOperationsAccess, success } from "../_shared/payments/http.ts";
import { getPaymentsConfig, getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import {
  extractTransferDestinationReference,
  syncAutomaticStripePayout,
} from "../_shared/payments/automatic-payouts.ts";

const runtime = getPaymentsRuntime("reconcile-stripe-transfers");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;
  const requestId = crypto.randomUUID();
  try {
    if (request.method !== "POST") throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    await requireInternalOperationsAccess(runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN"), request);
    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(config.supabaseUrl, config.serviceRoleKey);
    const stripe = createStripeClient(config.stripeApiKey);
    const expiredLeases = await client.rpc<Record<string, number>>("release_expired_payout_leases_v1", { p_limit: 50 });
    const paymentsReconciled = await reconcileSourceCharges(client, stripe);
    const transfersReconciled = [];
    const transfers = await client.get<Array<{ id: string; stripe_transfer_id: string }>>(
      "/rest/v1/stripe_transfers?select=id,stripe_transfer_id&stripe_transfer_id=not.is.null&status=in.(pending,failed,reconciliation_required)&limit=50",
    );
    for (const row of transfers) {
      const transfer = await stripe.transfers.retrieve(row.stripe_transfer_id, {
        expand: ["destination_payment.balance_transaction"],
      });
      const destination = extractTransferDestinationReference(transfer);
      if (!destination) {
        transfersReconciled.push({
          localTransferId: row.id,
          status: "reconciliation_required",
        });
        continue;
      }
      const status = await client.rpc<string>("reconcile_payout_transfer_v2", {
        p_connected_balance_available_on: destination.availableOn,
        p_observed_at: new Date(transfer.created * 1000).toISOString(),
        p_reversed: transfer.reversed,
        p_stripe_connected_balance_transaction_id: destination.balanceTransactionId,
        p_stripe_destination_payment_id: destination.destinationPaymentId,
        p_stripe_transfer_id: transfer.id,
        p_transfer_id: row.id,
      });
      transfersReconciled.push({ localTransferId: row.id, status });
    }

    const payoutsReconciled = [];
    const payouts = await client.get<Array<{
      id: string;
      automatic: boolean;
      stripe_payout_id: string;
      therapist_connect_accounts: { stripe_account_id: string } | null;
    }>>(
      "/rest/v1/stripe_payouts?select=id,stripe_payout_id,automatic,therapist_connect_accounts!inner(stripe_account_id)&stripe_payout_id=not.is.null&status=in.(creating,pending,in_transit,paid,failed,reconciliation_required)&limit=50",
    );
    for (const row of payouts) {
      const accountId = row.therapist_connect_accounts?.stripe_account_id;
      if (!accountId) continue;
      const payout = await stripe.payouts.retrieve(row.stripe_payout_id, {}, { stripeContext: accountId });
      const observedAt = new Date().toISOString();
      if (payout.automatic || row.automatic) {
        await syncAutomaticStripePayout({
          accountId,
          client,
          eventCreatedAt: observedAt,
          eventId: `reconcile:${row.id}:${payout.status}:${payout.created}`,
          payout,
          stripe,
          stripeMode: config.stripeMode,
        });
      } else {
        await client.rpc("apply_stripe_payout_state_v1", {
          p_arrival_at: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
          p_failure_code: payout.failure_code ?? null,
          p_failure_message: payout.failure_message ?? null,
          p_payout_batch_therapist_id: null,
          p_provider_status: payout.status,
          p_stripe_account_id: accountId,
          p_stripe_event_created_at: observedAt,
          p_stripe_event_id: `reconcile:${row.id}:${payout.status}:${payout.created}`,
          p_stripe_payout_id: payout.id,
        });
      }
      payoutsReconciled.push({ localPayoutId: row.id, status: payout.status });
    }

    return success({ expiredLeases, paymentsReconciled, payoutsReconciled, transfersReconciled });
  } catch (error) {
    return failure(error, requestId);
  }
});

async function reconcileSourceCharges(
  client: SupabaseRestClient,
  stripe: ReturnType<typeof createStripeClient>,
) {
  const rows = await client.get<Array<{
    id: string;
    stripe_payment_intent_id: string;
    transfer_blocked_reason: string | null;
  }>>("/rest/v1/session_payments?select=id,stripe_payment_intent_id,transfer_blocked_reason&financial_status=in.(paid,partially_refunded)&stripe_payment_intent_id=not.is.null&stripe_charge_id=is.null&limit=50");
  const reconciled = [];
  for (const payment of rows) {
    const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, { expand: ["latest_charge.balance_transaction"] });
    const charge = asRecord(intent.latest_charge);
    const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : stringOrNull(charge.id);
    if (intent.status !== "succeeded" || !chargeId) {
      reconciled.push({ paymentId: payment.id, reconciled: false, status: intent.status });
      continue;
    }
    const balanceTransaction = asRecord(charge.balance_transaction);
    await client.patch(`/rest/v1/session_payments?id=eq.${encodeURIComponent(payment.id)}`, {
      stripe_balance_transaction_id: stringOrNull(balanceTransaction.id),
      stripe_charge_id: chargeId,
      stripe_fee_amount_cents: numberOrNull(balanceTransaction.fee),
      stripe_net_amount_cents: numberOrNull(balanceTransaction.net),
      transfer_blocked_reason: payment.transfer_blocked_reason === "source_charge_reconciliation_required" ? null : payment.transfer_blocked_reason,
    }, "return=minimal");
    await client.rpc("refresh_session_transfer_eligibility", { p_session_payment_id: payment.id });
    reconciled.push({ paymentId: payment.id, reconciled: true });
  }
  return reconciled;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function stringOrNull(value: unknown) { return typeof value === "string" ? value : null; }
function numberOrNull(value: unknown) { return typeof value === "number" ? value : null; }
export {};
