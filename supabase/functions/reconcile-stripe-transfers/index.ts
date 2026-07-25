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
    const rows = await client.get<
      Array<{ id: string; stripe_transfer_id: string }>
    >(
      "/rest/v1/stripe_transfers?select=id,stripe_transfer_id&stripe_transfer_id=not.is.null&status=in.(pending,failed)&limit=50",
    );
    const reconciled = [];

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
      reconciled.push({ status, transferId: row.stripe_transfer_id });
    }

    return success({ reconciled });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
