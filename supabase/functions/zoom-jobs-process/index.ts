import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import { getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { getZoomConfig } from "../_shared/zoom/config.ts";
import { processZoomJobs } from "../_shared/zoom/job-worker.ts";

const runtime = getPaymentsRuntime("zoom-jobs-process");

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);

    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError(
        "missing_supabase_env",
        503,
        "Configuracao Supabase ausente.",
      );
    }

    await requireInternalOperationsAccess(
      runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN"),
      request,
    );

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const config = getZoomConfig(runtime);
    const result = await processZoomJobs({
      client,
      config,
      maxDurationMs: 8_500,
      maxJobs: 5,
      requestId,
    });

    return success({
      deadLetter: result.deadLetter,
      durationMs: result.durationMs,
      maxDurationReached: result.maxDurationReached,
      oldestJobAgeSeconds: result.oldestJobAgeSeconds,
      processed: result.processed > 0,
      processedCount: result.processed,
      reservedCount: result.reserved,
      retriedCount: result.retried,
      succeededCount: result.succeeded,
      workerId: result.workerId,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
