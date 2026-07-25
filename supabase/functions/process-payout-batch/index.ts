import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import { createIdempotencyKey } from "../_shared/payments/idempotency.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Body = {
  batchId?: string;
};

type BatchItemRow = {
  amount_cents: number;
  booking_id: string;
  id: string;
  session_payment_id: string;
  therapist_profile_id: string;
};

const runtime = getPaymentsRuntime("process-payout-batch");

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
    const body = await parseJsonBody<Body>(request);
    const batchId = requireUuid(body.batchId);
    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const items = await client.get<BatchItemRow[]>(
      `/rest/v1/payout_batch_items?select=id,session_payment_id,booking_id,therapist_profile_id,amount_cents&payout_batch_id=eq.${encodeURIComponent(batchId)}&status=eq.reserved`,
    );
    const results = [];

    await client.patch(
      `/rest/v1/payout_batches?id=eq.${encodeURIComponent(batchId)}`,
      { status: "processing" },
      "return=minimal",
    );

    for (const item of items) {
      const connectRows = await client.get<
        Array<{ id: string; stripe_account_id: string }>
      >(
        `/rest/v1/therapist_connect_accounts?select=id,stripe_account_id&therapist_profile_id=eq.${encodeURIComponent(
          item.therapist_profile_id,
        )}&stripe_transfers_status=eq.active&limit=1`,
      );
      const destination = connectRows[0]?.stripe_account_id;

      if (!destination) {
        await markItemFailed(
          client,
          item.id,
          "connect_missing",
          "Conta Connect nao encontrada.",
        );
        results.push({ itemId: item.id, ok: false });
        continue;
      }

      const idempotencyKey = createIdempotencyKey([
        "tes",
        config.stripeMode,
        "transfer",
        item.id,
      ]);

      try {
        await client.patch(
          `/rest/v1/payout_batch_items?id=eq.${encodeURIComponent(item.id)}`,
          { status: "transfer_pending" },
          "return=minimal",
        );
        const transfer = await stripe.transfers.create(
          {
            amount: item.amount_cents,
            currency: "brl",
            destination,
            metadata: {
              payout_batch_id: batchId,
              payout_batch_item_id: item.id,
              system: "tes",
              tes_session_id: item.booking_id,
              tes_session_payment_id: item.session_payment_id,
              tes_therapist_id: item.therapist_profile_id,
            },
            transfer_group: `tes_booking_${item.booking_id}`,
          },
          { idempotencyKey },
        );

        const transferRows = await client.post<Array<{ id: string }>>(
          "/rest/v1/stripe_transfers?select=id",
          {
            amount_cents: item.amount_cents,
            connect_account_id: connectRows[0].id,
            currency: "BRL",
            idempotency_key: idempotencyKey,
            payout_batch_item_id: item.id,
            session_payment_id: item.session_payment_id,
            status: "transferred",
            stripe_transfer_id: transfer.id,
            therapist_profile_id: item.therapist_profile_id,
            transferred_at: new Date().toISOString(),
          },
          "return=representation",
        );

        await client.patch(
          `/rest/v1/payout_batch_items?id=eq.${encodeURIComponent(item.id)}`,
          { status: "transferred" },
          "return=minimal",
        );
        await client.patch(
          `/rest/v1/session_payments?id=eq.${encodeURIComponent(item.session_payment_id)}`,
          { transfer_status: "transferred" },
          "return=minimal",
        );
        await client.post(
          "/rest/v1/financial_ledger_entries",
          {
            amount_cents: item.amount_cents,
            booking_id: item.booking_id,
            direction: "debit",
            entry_type: "transfer",
            payout_batch_id: batchId,
            session_payment_id: item.session_payment_id,
            source_id: transferRows[0]?.id ?? null,
            source_table: "stripe_transfers",
            therapist_profile_id: item.therapist_profile_id,
          },
          "return=minimal",
        );
        results.push({ itemId: item.id, ok: true, transferId: transfer.id });
      } catch (error) {
        await markItemFailed(
          client,
          item.id,
          "stripe_transfer_failed",
          error instanceof Error ? error.message : "UNKNOWN",
        );
        results.push({ itemId: item.id, ok: false });
      }
    }

    const failed = results.some((result) => !result.ok);
    await client.patch(
      `/rest/v1/payout_batches?id=eq.${encodeURIComponent(batchId)}`,
      {
        processed_at: new Date().toISOString(),
        status: failed ? "partially_failed" : "completed",
      },
      "return=minimal",
    );

    return success({ results });
  } catch (error) {
    return failure(error, requestId);
  }
});

async function markItemFailed(
  client: SupabaseRestClient,
  itemId: string,
  code: string,
  message: string,
) {
  await client.patch(
    `/rest/v1/payout_batch_items?id=eq.${encodeURIComponent(itemId)}`,
    {
      failure_code: code,
      failure_message: message.slice(0, 500),
      status: "failed",
    },
    "return=minimal",
  );
}

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError("invalid_batch_id", 422, "Identificador invalido.");
  }

  return value;
}

export {};
