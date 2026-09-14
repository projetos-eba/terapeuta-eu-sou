import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import { resolveFinanceOperationInstant } from "../_shared/payments/finance-lifecycle.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { runSessionChargeWorker } from "../_shared/payments/session-charge-worker.ts";
import { runSessionClosureWorker } from "../_shared/payments/session-closure-worker.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

const runtime = getPaymentsRuntime("process-session-charges");

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
    if (!config.sessionFinancialFlowV10Enabled) {
      return success({ claimed: 0, enabled: false });
    }
    const body = await parseJsonBody<{ limit?: number; nowOverride?: string }>(
      request,
    );
    const now = resolveFinanceOperationInstant({
      config,
      defaultInstant: new Date().toISOString(),
      fieldName: "now_override",
      override: body.nowOverride,
    });
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const result = await runSessionChargeWorker({
      client,
      stripe,
      environment: config.environment,
      now,
      workerId: crypto.randomUUID(),
      limit:
        Number.isInteger(body.limit) &&
        Number(body.limit) >= 1 &&
        Number(body.limit) <= 20
          ? Number(body.limit)
          : 10,
    });
    const closures = await runSessionClosureWorker({
      client,
      environment: config.environment,
      limit:
        Number.isInteger(body.limit) &&
        Number(body.limit) >= 1 &&
        Number(body.limit) <= 20
          ? Number(body.limit)
          : 10,
      now,
      stripe,
    });
    return success({ ...result, closures });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
