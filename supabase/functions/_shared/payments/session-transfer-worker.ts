import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import { extractTransferDestinationReference } from "./automatic-payouts.ts";
import {
  assertConnectAccountOwnership,
  deriveConnectAccountState,
  derivePayoutSettingsState,
  retrieveAccountV2,
} from "./connect.ts";
import { buildImmediateSessionTransferCreateParams } from "./finance-lifecycle.ts";
import type { StripeClient } from "./stripe-client.ts";

type Claim = {
  jobId: string;
  stripeEnvironment: "test" | "live";
  attemptCount: number;
  bookingId: string;
  therapistProfileId: string;
  paymentIntentId: string;
  grossAmountCents: number;
  stripeAccountId: string;
  sourceChargeId: string;
};

type Prepared = {
  jobId: string;
  transferId: string | null;
  bookingId: string;
  sessionPaymentId: string;
  therapistProfileId: string;
  paymentIntentId: string;
  grossAmountCents: number;
  stripeAccountId: string;
  sourceChargeId: string;
  amountCents: number;
  debtOffsetCents: number;
  idempotencyKey: string;
  stripeTransferId: string | null;
};

type TransferClient = Pick<SupabaseRestClient, "rpc">;
type TransferStripe = Pick<StripeClient, "balanceSettings" | "charges" | "transfers">;

export async function runSessionTransferWorker(input: {
  client: TransferClient;
  stripe: TransferStripe;
  stripeApiKey: string;
  environment: "test" | "live";
  workerId: string;
  limit: number;
  now?: string;
  accountPreflight?: (accountId: string, therapistId: string) => Promise<void>;
}) {
  const claimed = await input.client.rpc<{ claims: Claim[] }>(
    "claim_session_transfer_jobs_v10",
    {
      p_now: input.now ?? new Date().toISOString(),
      p_worker_id: input.workerId,
      p_limit: input.limit,
      p_lease_minutes: 5,
    },
  );
  const result = { claimed: claimed.claims.length, transferred: 0, offsetOnly: 0, needsReconciliation: 0, failed: 0 };
  for (const claim of claimed.claims) {
    let preparedForProvider = false;
    let stage = "claim_validation";
    try {
      if (claim.stripeEnvironment !== input.environment) {
        throw new Error("session_transfer_environment_mismatch");
      }
      assertClaim(claim);
      stage = "charge_preflight";
      const charge = await input.stripe.charges.retrieve(claim.sourceChargeId);
      if (
        !charge.paid || charge.status !== "succeeded" || charge.refunded ||
        charge.disputed || charge.currency !== "brl" ||
        charge.amount !== claim.grossAmountCents ||
        objectId(charge.payment_intent) !== claim.paymentIntentId
      ) {
        throw new Error("session_transfer_charge_not_ready");
      }
      stage = "account_preflight";
      if (input.accountPreflight) {
        await input.accountPreflight(claim.stripeAccountId, claim.therapistProfileId);
      } else {
        const account = await retrieveAccountV2(input.stripeApiKey, claim.stripeAccountId);
        const payoutSettings = await input.stripe.balanceSettings.retrieve(
          {},
          { stripeContext: claim.stripeAccountId },
        );
        assertConnectAccountOwnership(account, {
          environment: input.environment,
          therapistProfileId: claim.therapistProfileId,
        });
        const state = deriveConnectAccountState(
          account,
          derivePayoutSettingsState(
            payoutSettings as unknown as Record<string, unknown>,
          ),
        );
        if (
          state.transfersStatus !== "active" ||
          state.operationalStatus !== "ready" ||
          !state.payoutsEnabled ||
          state.payoutScheduleInterval !== "daily"
        ) {
          throw Object.assign(new Error("connect_account_not_ready"), {
            code: "connect_account_not_ready",
            statusCode: 422,
          });
        }
      }
      stage = "preparation";
      const prepared = await input.client.rpc<Prepared>(
        "prepare_session_transfer_job_v10",
        { p_job_id: claim.jobId, p_worker_id: input.workerId },
      );
      if (prepared.amountCents === 0) {
        result.offsetOnly += 1;
        continue;
      }
      assertPrepared(prepared, claim);
      preparedForProvider = true;

      stage = "provider_transfer";
      let transfer;
      if (prepared.stripeTransferId) {
        transfer = await input.stripe.transfers.retrieve(prepared.stripeTransferId, {
          expand: ["destination_payment.balance_transaction"],
        });
      } else if (claim.attemptCount > 1) {
        // An expired Stripe idempotency key must never create a second Transfer.
        // Search for the first attempt, then quarantine any unresolved outcome.
        const page = await input.stripe.transfers.list({
          transfer_group: `tes_booking_${prepared.bookingId}`,
          limit: 100,
        });
        const matches = page.data.filter((candidate) =>
          candidate.metadata?.tes_transfer_job_id === prepared.jobId &&
          candidate.source_transaction === prepared.sourceChargeId &&
          candidate.destination === prepared.stripeAccountId &&
          candidate.amount === prepared.amountCents
        );
        if (page.has_more || matches.length !== 1) {
          throw new AmbiguousTransferOutcome();
        }
        transfer = await input.stripe.transfers.retrieve(matches[0].id, {
          expand: ["destination_payment.balance_transaction"],
        });
      } else {
        transfer = await input.stripe.transfers.create(
          buildImmediateSessionTransferCreateParams({
            amountCents: prepared.amountCents,
            bookingId: prepared.bookingId,
            destination: prepared.stripeAccountId,
            jobId: prepared.jobId,
            sessionPaymentId: prepared.sessionPaymentId,
            sourceChargeId: prepared.sourceChargeId,
          }),
          { idempotencyKey: prepared.idempotencyKey },
        );
      }
      if (
        transfer.source_transaction !== prepared.sourceChargeId ||
        transfer.destination !== prepared.stripeAccountId ||
        transfer.amount !== prepared.amountCents ||
        transfer.currency !== "brl" ||
        transfer.metadata?.tes_transfer_job_id !== prepared.jobId
      ) {
        throw new AmbiguousTransferOutcome();
      }
      const destination = extractTransferDestinationReference(transfer);
      stage = "completion";
      await input.client.rpc("complete_session_transfer_job_v10", {
        p_job_id: prepared.jobId,
        p_worker_id: input.workerId,
        p_stripe_transfer_id: transfer.id,
        p_destination_payment_id: destination?.destinationPaymentId ?? null,
        p_connected_balance_transaction_id: destination?.balanceTransactionId ?? null,
        p_connected_balance_available_on: destination?.availableOn ?? null,
        p_transferred_at: new Date(transfer.created * 1000).toISOString(),
      });
      result.transferred += 1;
    } catch (error) {
      // After preparation, debts and their allocations are durable. Any
      // provider-side failure must be reconciled before the job can move again;
      // otherwise an automatic retry could double-consume debt or duplicate a
      // Transfer whose response was lost.
      const ambiguous = preparedForProvider || isAmbiguousTransferFailure(error);
      await input.client.rpc("fail_session_transfer_job_v10", {
        p_job_id: claim.jobId,
        p_worker_id: input.workerId,
        p_error_code: classifyTransferError(error, stage),
        p_ambiguous: ambiguous,
      });
      if (ambiguous) result.needsReconciliation += 1;
      else result.failed += 1;
    }
  }
  return result;
}

class AmbiguousTransferOutcome extends Error {
  code = "transfer_outcome_unknown";
}

function assertPrepared(value: Prepared, claim: Claim) {
  if (
    value.jobId !== claim.jobId || !value.transferId ||
    !Number.isSafeInteger(value.amountCents) || value.amountCents <= 0 ||
    !value.stripeAccountId?.startsWith("acct_") ||
    !value.sourceChargeId?.startsWith("ch_") ||
    !value.idempotencyKey || !value.paymentIntentId
  ) {
    throw new Error("session_transfer_preparation_invalid");
  }
}

function assertClaim(value: Claim) {
  if (
    !value.jobId || !value.bookingId || !value.therapistProfileId ||
    !value.paymentIntentId?.startsWith("pi_") ||
    !value.sourceChargeId?.startsWith("ch_") ||
    !value.stripeAccountId?.startsWith("acct_") ||
    !Number.isSafeInteger(value.grossAmountCents) || value.grossAmountCents <= 0
  ) {
    throw new Error("session_transfer_claim_invalid");
  }
}

function objectId(value: unknown) {
  return typeof value === "string"
    ? value
    : value && typeof value === "object" && "id" in value
    ? String(value.id)
    : null;
}

function isAmbiguousTransferFailure(error: unknown) {
  if (error instanceof AmbiguousTransferOutcome) return true;
  if (!error || typeof error !== "object") return false;
  const value = error as { statusCode?: number; type?: string; code?: string };
  return (
    (typeof value.statusCode === "number" && value.statusCode >= 500) ||
    value.statusCode === 429 ||
    value.type === "StripeConnectionError" ||
    value.code === "ETIMEDOUT" ||
    value.code === "ECONNRESET"
  );
}

function classifyTransferError(error: unknown, stage: string) {
  if (error instanceof AmbiguousTransferOutcome) return error.code;
  const value = error && typeof error === "object"
    ? error as { code?: unknown; type?: unknown }
    : {};
  const code = typeof value.code === "string" && /^[a-z0-9_]{1,80}$/.test(value.code)
    ? value.code
    : null;
  return code ?? (isAmbiguousTransferFailure(error)
    ? "provider_state_unknown"
    : `session_transfer_${stage}_failed`);
}
