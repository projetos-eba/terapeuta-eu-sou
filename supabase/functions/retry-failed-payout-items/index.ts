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
import {
  recordBatchWorkerFailure,
  resolveBatchWorkerFailure,
} from "../_shared/payments/payout-observability.ts";
import { getPaymentsConfig, getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Body = { batchId?: string };
const runtime = getPaymentsRuntime("retry-failed-payout-items");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;
  const requestId = crypto.randomUUID();
  let workerContext: { batchId: string; client: SupabaseRestClient } | null = null;
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
    workerContext = { batchId, client };
    const result = await runPayoutBatchWorker({
      batchId,
      client,
      stripe: createStripeClient(config.stripeApiKey),
      stripeApiKey: config.stripeApiKey,
      stripeMode: config.stripeMode,
      workerId: crypto.randomUUID(),
    });
    await resolveBatchWorkerFailure({
      batchId,
      client,
      operation: "retry_failed_payout_items",
    });
    return success({ batchId, ...result });
  } catch (error) {
    if (workerContext) {
      try {
        await recordBatchWorkerFailure({
          ...workerContext,
          error,
          operation: "retry_failed_payout_items",
          requestId,
        });
      } catch {
        console.error(JSON.stringify({
          code: "PAYOUT_RETRY_FAILURE_RECORD_FAILED",
          request_id: requestId,
        }));
      }
    }
    return failure(error, requestId);
  }
});

function requireUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new DomainError("invalid_batch_id", 422, "Identificador invalido.");
  }
  return value;
}

export {};
