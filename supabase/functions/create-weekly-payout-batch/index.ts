import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireInternalOperationsAccess,
  parseJsonBody,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";

type Body = {
  referencePeriodEnd?: string;
  referencePeriodStart?: string;
};

const runtime = getPaymentsRuntime("create-weekly-payout-batch");

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
    const start = requireDate(
      body.referencePeriodStart,
      "reference_period_start",
    );
    const end = requireDate(body.referencePeriodEnd, "reference_period_end");
    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const batchId = await client.rpc<string>("create_weekly_payout_batch", {
      p_cutoff_at: new Date().toISOString(),
      p_reference_period_end: end,
      p_reference_period_start: start,
    });

    return success({ batchId });
  } catch (error) {
    return failure(error, requestId);
  }
});

function requireDate(value: unknown, code: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError(code, 422, "Data invalida.");
  }

  return value;
}

export {};
