import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { resolveFinanceOperationInstant } from "../_shared/payments/finance-lifecycle.ts";
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

type Body = { nowOverride?: string };
type Claim = {
  acquired: boolean;
  batchId?: string;
  reason?: string;
  runId?: string;
  windowOpen?: boolean;
};

const runtime = getPaymentsRuntime("weekly-payout-scheduler");

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
    const config = getPaymentsConfig(runtime);
    const now = resolveFinanceOperationInstant({
      config,
      defaultInstant: new Date().toISOString(),
      fieldName: "now_override",
      override: body.nowOverride,
    });
    const client = new SupabaseRestClient(config.supabaseUrl, config.serviceRoleKey);
    const workerId = crypto.randomUUID();
    const claim = await client.rpc<Claim>("claim_weekly_payout_scheduler_run_v1", {
      p_lease_minutes: 5,
      p_now: now,
      p_worker_id: workerId,
    });

    if (!claim.acquired || !claim.batchId || !claim.runId) {
      return success({ acquired: false, reason: claim.reason ?? "not_available" });
    }

    const result = await runPayoutBatchWorker({
      batchId: claim.batchId,
      client,
      stripe: createStripeClient(config.stripeApiKey),
      stripeApiKey: config.stripeApiKey,
      stripeMode: config.stripeMode,
      workerId,
    });
    await client.rpc("mark_payout_window_incomplete_v1", {
      p_now: now,
      p_run_id: claim.runId,
    });
    const finalized = await client.rpc<Record<string, unknown>>(
      "finalize_payout_scheduler_run_v1",
      { p_scheduler_run_id: claim.runId },
    );

    return success({
      acquired: true,
      batchId: claim.batchId,
      finalized,
      payoutsProcessed: result.payouts.length,
      runId: claim.runId,
      transfersProcessed: result.transfers.length,
      windowOpen: claim.windowOpen === true,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
