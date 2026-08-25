import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import { runPayoutBatchWorker } from "../_shared/payments/payout-worker.ts";
import { getPaymentsConfig, getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Body = { batchId?: string; maxPayouts?: number; maxTransfers?: number };

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
    const result = await runPayoutBatchWorker({
      batchId,
      client: new SupabaseRestClient(config.supabaseUrl, config.serviceRoleKey),
      maxPayouts: boundedLimit(body.maxPayouts),
      maxTransfers: boundedLimit(body.maxTransfers),
      stripe: createStripeClient(config.stripeApiKey),
      stripeApiKey: config.stripeApiKey,
      stripeMode: config.stripeMode,
      workerId: crypto.randomUUID(),
    });
    return success({ batchId, ...result });
  } catch (error) {
    return failure(error, requestId);
  }
});

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError("invalid_batch_id", 422, "Identificador invalido.");
  }
  return value;
}

function boundedLimit(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 50
    ? Number(value)
    : 10;
}

export {};
