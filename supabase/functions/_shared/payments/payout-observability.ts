import { SupabaseHttpError, SupabaseRestClient } from "../auth/supabase-rest.ts";

export type SanitizedPayoutFailure = {
  code: string;
  message: string;
};

export function sanitizePayoutFailure(error: unknown): SanitizedPayoutFailure {
  if (error instanceof SupabaseHttpError) {
    return {
      code: `supabase_http_${error.status}`,
      message: sanitizeMessage(error.safeDetails ?? "Supabase request failed."),
    };
  }

  if (error instanceof Error) {
    const candidateCode = (error as Error & { code?: unknown }).code;
    return {
      code: sanitizeCode(
        typeof candidateCode === "string"
          ? candidateCode
          : error.name || "worker_failure",
      ),
      message: sanitizeMessage(error.message || "Worker execution failed."),
    };
  }

  return {
    code: "worker_failure",
    message: "Worker execution failed.",
  };
}

export async function recordSchedulerFailure(args: {
  client: SupabaseRestClient;
  error: unknown;
  requestId: string;
  runId: string;
  workerId: string;
}) {
  const failure = sanitizePayoutFailure(args.error);
  return await args.client.rpc<Record<string, unknown>>(
    "record_payout_scheduler_failure_v1",
    {
      p_error_code: failure.code,
      p_error_message: failure.message,
      p_request_id: args.requestId,
      p_run_id: args.runId,
      p_worker_id: args.workerId,
    },
  );
}

export async function recordBatchWorkerFailure(args: {
  batchId: string;
  client: SupabaseRestClient;
  error: unknown;
  operation: "process_payout_batch" | "retry_failed_payout_items";
  requestId: string;
}) {
  const failure = sanitizePayoutFailure(args.error);
  return await args.client.rpc<string>("record_payout_operational_incident_v1", {
    p_error_code: failure.code,
    p_error_message: failure.message,
    p_incident_key: `batch:${args.batchId}:worker:${args.operation}`,
    p_incident_type: `${args.operation}_failed`,
    p_metadata: {
      operation: args.operation,
      requestId: args.requestId,
    },
    p_payout_batch_id: args.batchId,
    p_severity: "critical",
  });
}

export async function resolveBatchWorkerFailure(args: {
  batchId: string;
  client: SupabaseRestClient;
  operation: "process_payout_batch" | "retry_failed_payout_items";
}) {
  return await args.client.rpc<boolean>("resolve_payout_operational_incident_v1", {
    p_incident_key: `batch:${args.batchId}:worker:${args.operation}`,
  });
}

function sanitizeCode(value: string) {
  const sanitized = value
    .replace(/[\r\n]+/g, " ")
    .replace(/[^a-zA-Z0-9_.-]+/g, "_")
    .slice(0, 120);
  return sanitized || "worker_failure";
}

function sanitizeMessage(value: string) {
  return value.replace(/[\r\n]+/g, " ").slice(0, 500) ||
    "Worker execution failed.";
}
