import { SupabaseRestClient } from "../auth/supabase-rest.ts";
import {
  assertConnectAccountOwnership,
  deriveConnectAccountState,
  derivePayoutSettingsState,
  retrieveAccountV2,
  retrieveBalanceSettings,
} from "./connect.ts";
import { extractTransferDestinationReference } from "./automatic-payouts.ts";
import { buildSessionTransferCreateParams } from "./finance-lifecycle.ts";
import { classifyProviderFailure } from "./payouts.ts";
import type { StripeClient } from "./stripe-client.ts";

type TransferClaim = {
  amount_cents: number;
  attempt_count: number;
  booking_id: string;
  connect_account_id: string;
  idempotency_key: string;
  payout_batch_item_id: string;
  request_fingerprint: string;
  session_payment_id: string;
  stripe_account_id: string;
  stripe_charge_id: string;
  therapist_profile_id: string;
  transfer_id: string;
};

type PaymentState = {
  admin_blocked_at: string | null;
  disputed_at: string | null;
  eligible_at: string | null;
  financial_status: string;
  internal_contested_at: string | null;
  refund_pending: boolean;
  stripe_balance_transaction_id: string | null;
  stripe_charge_id: string | null;
  therapist_amount_cents: number;
  transfer_status: string;
};

export async function runPayoutBatchWorker(input: {
  batchId: string;
  client: SupabaseRestClient;
  maxPayouts?: number;
  maxTransfers?: number;
  stripe: StripeClient;
  stripeApiKey: string;
  stripeMode: "live" | "test";
  workerId: string;
}) {
  const transferClaims = await input.client.rpc<TransferClaim[]>(
    "claim_payout_transfer_items_v1",
    {
      p_lease_minutes: 5,
      p_limit: input.maxTransfers ?? 10,
      p_environment: input.stripeMode,
      p_payout_batch_id: input.batchId,
      p_worker_id: input.workerId,
    },
  );
  const transfers = [];

  for (const claim of transferClaims) {
    try {
      await assertTransferClaimIsReady(input, claim);
      const transfer = await input.stripe.transfers.create(
        buildSessionTransferCreateParams({
          amountCents: claim.amount_cents,
          batchId: input.batchId,
          bookingId: claim.booking_id,
          destination: claim.stripe_account_id,
          itemId: claim.payout_batch_item_id,
          sessionPaymentId: claim.session_payment_id,
          sourceChargeId: claim.stripe_charge_id,
          therapistProfileId: claim.therapist_profile_id,
        }),
        { idempotencyKey: claim.idempotency_key },
      );
      let destination = extractTransferDestinationReference(transfer);
      if (!destination) {
        const authoritative = await input.stripe.transfers.retrieve(
          transfer.id,
          { expand: ["destination_payment.balance_transaction"] },
        );
        destination = extractTransferDestinationReference(authoritative);
      }
      if (!destination) {
        throw Object.assign(new Error("Transfer sem contrapartida conciliavel."), {
          code: "provider_response_unknown",
          type: "StripeConnectionError",
        });
      }
      await input.client.rpc("complete_payout_transfer_v2", {
        p_connected_balance_available_on: destination.availableOn,
        p_stripe_connected_balance_transaction_id: destination.balanceTransactionId,
        p_stripe_destination_payment_id: destination.destinationPaymentId,
        p_stripe_transfer_id: transfer.id,
        p_transfer_id: claim.transfer_id,
        p_transferred_at: new Date(transfer.created * 1000).toISOString(),
        p_worker_id: input.workerId,
      });
      transfers.push({ itemId: claim.payout_batch_item_id, status: "transferred" });
    } catch (error) {
      const failure = classifyProviderFailure(error);
      await input.client.rpc("fail_payout_transfer_v1", {
        p_disposition: failure.disposition,
        p_error_code: failure.code,
        p_error_message: failure.message,
        p_transfer_id: claim.transfer_id,
        p_worker_id: input.workerId,
      });
      transfers.push({
        itemId: claim.payout_batch_item_id,
        status: failure.disposition,
      });
    }
  }

  return { payouts: [], transfers };
}

async function assertTransferClaimIsReady(
  input: Parameters<typeof runPayoutBatchWorker>[0],
  claim: TransferClaim,
) {
  const [payment] = await input.client.get<PaymentState[]>(
    `/rest/v1/session_payments?select=financial_status,refund_pending,disputed_at,internal_contested_at,admin_blocked_at,stripe_charge_id,stripe_balance_transaction_id,therapist_amount_cents,transfer_status,eligible_at&id=eq.${
      encodeURIComponent(claim.session_payment_id)
    }&limit=1`,
  );
  const accountRows = await input.client.get<
    Array<{
      operational_status: string;
      payout_schedule_interval: string | null;
      payout_status: string;
      payouts_enabled: boolean;
      stripe_transfers_status: string;
      therapist_profiles: { status: string } | null;
    }>
  >(
    `/rest/v1/therapist_connect_accounts?select=operational_status,payout_schedule_interval,payout_status,payouts_enabled,stripe_transfers_status,therapist_profiles!inner(status)&id=eq.${
      encodeURIComponent(claim.connect_account_id)
    }&therapist_profile_id=eq.${
      encodeURIComponent(claim.therapist_profile_id)
    }&limit=1`,
  );
  const account = accountRows[0];
  const now = Date.now();

  if (
    !payment ||
    !["paid", "partially_refunded"].includes(payment.financial_status) ||
    payment.refund_pending ||
    payment.disputed_at !== null ||
    payment.internal_contested_at !== null ||
    payment.admin_blocked_at !== null ||
    payment.stripe_charge_id !== claim.stripe_charge_id ||
    !payment.stripe_balance_transaction_id ||
    payment.therapist_amount_cents !== claim.amount_cents ||
    payment.therapist_amount_cents <= 0 ||
    !payment.eligible_at ||
    new Date(payment.eligible_at).getTime() > now ||
    !account ||
    account.therapist_profiles?.status !== "approved" ||
    account.operational_status !== "ready" ||
    account.stripe_transfers_status !== "active"
  ) {
    throw Object.assign(new Error("Pagamento ou conta nao elegivel para repasse."), {
      code: "transfer_business_block",
      statusCode: 422,
    });
  }

  const remote = await retrieveAccountV2(input.stripeApiKey, claim.stripe_account_id);
  const payoutSettings = await retrieveBalanceSettings(
    input.stripe,
    claim.stripe_account_id,
  );
  const state = deriveConnectAccountState(
    remote,
    derivePayoutSettingsState(payoutSettings as unknown as Record<string, unknown>),
  );
  assertConnectAccountOwnership(remote, {
    environment: input.stripeMode,
    therapistProfileId: claim.therapist_profile_id,
  });
  if (
    state.transfersStatus !== "active" ||
    state.operationalStatus !== "ready" ||
    !state.payoutsEnabled ||
    state.payoutScheduleInterval !== "daily"
  ) {
    throw Object.assign(new Error("Conta Connect nao esta pronta para Transfer."), {
      code: "connect_account_not_ready",
      statusCode: 422,
    });
  }
}
