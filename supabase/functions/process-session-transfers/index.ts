import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import { getPaymentsConfig, getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { runSessionTransferWorker } from "../_shared/payments/session-transfer-worker.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

const runtime = getPaymentsRuntime("process-session-transfers");

runtime.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
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
    if (!config.sessionFinancialFlowV10Enabled) {
      return success({ enabled: false, claimed: 0 });
    }
    const body = await parseJsonBody<{ limit?: number }>(request);
    const limit = Number.isInteger(body.limit) && Number(body.limit) >= 1 && Number(body.limit) <= 20
      ? Number(body.limit)
      : 10;
    const client = new SupabaseRestClient(config.supabaseUrl, config.serviceRoleKey);
    const result = await runSessionTransferWorker({
      client,
      environment: config.environment,
      limit,
      stripe: createStripeClient(config.stripeApiKey),
      stripeApiKey: config.stripeApiKey,
      workerId: crypto.randomUUID(),
    });
    return success(result);
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
