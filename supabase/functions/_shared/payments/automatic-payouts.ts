import type Stripe from "stripe";

import type { SupabaseRestClient } from "../auth/supabase-rest.ts";
import type { StripeClient } from "./stripe-client.ts";

export type TransferDestinationReference = {
  availableOn: string | null;
  balanceTransactionId: string | null;
  destinationPaymentId: string;
};

export function extractTransferDestinationReference(
  transfer: Pick<Stripe.Transfer, "destination_payment">,
): TransferDestinationReference | null {
  const destinationPayment = transfer.destination_payment;
  if (typeof destinationPayment === "string") {
    return {
      availableOn: null,
      balanceTransactionId: null,
      destinationPaymentId: destinationPayment,
    };
  }
  if (!destinationPayment || typeof destinationPayment !== "object") {
    return null;
  }
  const payment = destinationPayment as unknown as Record<string, unknown>;
  const id = stringOrNull(payment.id);
  if (!id) return null;
  const balanceTransaction = payment.balance_transaction;
  if (typeof balanceTransaction === "string") {
    return {
      availableOn: null,
      balanceTransactionId: balanceTransaction,
      destinationPaymentId: id,
    };
  }
  const balance = asRecord(balanceTransaction);
  return {
    availableOn: unixTimeToIso(balance.available_on),
    balanceTransactionId: stringOrNull(balance.id),
    destinationPaymentId: id,
  };
}

export function sanitizePayoutBalanceTransaction(
  transaction: Stripe.BalanceTransaction,
) {
  return {
    amount: transaction.amount,
    available_on: transaction.available_on,
    created: transaction.created,
    currency: transaction.currency,
    id: transaction.id,
    net: transaction.net,
    reporting_category: transaction.reporting_category,
    source: typeof transaction.source === "string"
      ? transaction.source
      : stringOrNull(asRecord(transaction.source).id),
    type: transaction.type,
  };
}

type SanitizedPayoutTransaction =
  & ReturnType<
    typeof sanitizePayoutBalanceTransaction
  >
  & { verified_refund_charge?: string };

// A zero-sum pair is not enough evidence to omit provider movements. The
// connected-account Refund must identify the exact payment and balance debit.
export async function annotateVerifiedPayoutRefunds(
  transactions: SanitizedPayoutTransaction[],
  stripe: StripeClient,
  accountId: string,
): Promise<SanitizedPayoutTransaction[]> {
  const payments = transactions.filter((transaction) =>
    transaction.type === "payment" && transaction.amount > 0 &&
    transaction.net > 0 && transaction.currency === "brl" &&
    transaction.source
  );
  const verified = new Map<string, string>();

  for (const transaction of transactions) {
    if (
      transaction.type !== "payment_refund" || transaction.amount >= 0 ||
      transaction.net >= 0 || transaction.currency !== "brl" ||
      !transaction.source
    ) continue;

    try {
      const refund = await stripe.refunds.retrieve(
        transaction.source,
        {},
        { stripeContext: accountId },
      );
      const chargeId = objectId(refund.charge);
      if (
        refund.status !== "succeeded" ||
        refund.amount !== -transaction.amount ||
        refund.currency !== transaction.currency ||
        objectId(refund.balance_transaction) !== transaction.id ||
        !chargeId ||
        payments.filter((payment) =>
            payment.source === chargeId &&
            payment.amount === -transaction.amount &&
            payment.net === -transaction.net
          ).length !== 1
      ) continue;
      verified.set(transaction.id, chargeId);
    } catch {
      // Missing provider evidence remains unmatched in the database.
    }
  }

  return transactions.map((transaction) => {
    const chargeId = verified.get(transaction.id);
    return chargeId
      ? { ...transaction, verified_refund_charge: chargeId }
      : transaction;
  });
}

export function isAllocatablePayoutBalanceTransaction(
  transaction: Stripe.BalanceTransaction,
) {
  return (
    transaction.type !== "payout" && transaction.reporting_category !== "payout"
  );
}

export async function syncAutomaticStripePayout(input: {
  accountId: string;
  client: SupabaseRestClient;
  eventCreatedAt: string;
  eventId: string;
  payout: Stripe.Payout;
  stripe: StripeClient;
  stripeMode: "live" | "test";
}) {
  if (input.payout.automatic !== true) {
    return { handled: false, reason: "manual_payout" };
  }
  if (input.payout.livemode !== (input.stripeMode === "live")) {
    throw Object.assign(new Error("Ambiente do Payout incompativel."), {
      code: "payout_environment_mismatch",
      statusCode: 422,
    });
  }
  if (input.payout.currency !== "brl" || input.payout.amount <= 0) {
    throw Object.assign(new Error("Payout automatico fora do contrato BRL."), {
      code: "automatic_payout_contract_mismatch",
      statusCode: 422,
    });
  }

  const recorded = await input.client.rpc<Record<string, unknown>>(
    "record_automatic_stripe_payout_v1",
    {
      p_amount_cents: input.payout.amount,
      p_arrival_at: input.payout.arrival_date
        ? new Date(input.payout.arrival_date * 1000).toISOString()
        : null,
      p_currency: input.payout.currency,
      p_failure_code: input.payout.failure_code ?? null,
      p_failure_message: input.payout.failure_message ?? null,
      p_payout_balance_transaction_id: objectId(
        input.payout.balance_transaction,
      ),
      p_provider_reconciliation_status: input.payout.reconciliation_status ??
        "not_applicable",
      p_provider_status: input.payout.status,
      p_source_type: input.payout.source_type ?? null,
      p_stripe_account_id: input.accountId,
      p_stripe_event_created_at: input.eventCreatedAt,
      p_stripe_event_id: input.eventId,
      p_stripe_payout_id: input.payout.id,
    },
  );

  if (input.payout.reconciliation_status !== "completed") {
    return {
      handled: true,
      payoutId: recorded.payoutId ?? null,
      reconciliationStatus: input.payout.reconciliation_status ?? "not_applicable",
    };
  }

  const transactions = [];
  let startingAfter: string | undefined;
  do {
    const page = await input.stripe.balanceTransactions.list(
      {
        limit: 100,
        payout: input.payout.id,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
      { stripeContext: input.accountId },
    );
    transactions.push(
      ...page.data
        .filter(isAllocatablePayoutBalanceTransaction)
        .map(sanitizePayoutBalanceTransaction),
    );
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
    if (page.has_more && !startingAfter) {
      throw Object.assign(new Error("Paginacao de conciliacao incompleta."), {
        code: "payout_reconciliation_pagination_invalid",
        statusCode: 502,
      });
    }
  } while (startingAfter);

  const reconciliation = await input.client.rpc<Record<string, unknown>>(
    "reconcile_automatic_stripe_payout_v2",
    {
      p_balance_transactions: await annotateVerifiedPayoutRefunds(
        transactions,
        input.stripe,
        input.accountId,
      ),
      p_observed_at: new Date().toISOString(),
      p_stripe_account_id: input.accountId,
      p_stripe_payout_id: input.payout.id,
    },
  );
  return {
    handled: true,
    payoutId: recorded.payoutId ?? null,
    reconciliation,
    reconciliationStatus: "completed",
  };
}

function objectId(value: unknown) {
  return typeof value === "string" ? value : stringOrNull(asRecord(value).id);
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function unixTimeToIso(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}
