import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";

type Body = {
  batchId?: string;
};

const runtime = getPaymentsRuntime("retry-failed-payout-items");

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

    await client.patch(
      `/rest/v1/payout_batch_items?payout_batch_id=eq.${encodeURIComponent(batchId)}&status=eq.failed`,
      {
        failure_code: null,
        failure_message: null,
        status: "reserved",
      },
      "return=minimal",
    );
    await client.patch(
      `/rest/v1/payout_batches?id=eq.${encodeURIComponent(batchId)}`,
      { status: "open" },
      "return=minimal",
    );

    return success({ batchId, status: "open" });
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

export {};
