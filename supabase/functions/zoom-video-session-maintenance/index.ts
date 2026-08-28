import { getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireInternalOperationsAccess,
  success,
} from "../_shared/payments/http.ts";
import { getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { ZoomVideoSdkApiClient } from "../_shared/zoom-video-sdk/api-client.ts";
import { getZoomVideoSdkConfig } from "../_shared/zoom-video-sdk/config.ts";
import {
  hasConfirmedProviderClosure,
  isLegacyReentrantControlOperation,
} from "../_shared/zoom-video-sdk/session-lifecycle.ts";
import {
  sanitizeProviderMessage,
  ZoomVideoSdkError,
} from "../_shared/zoom-video-sdk/errors.ts";

type ControlJob = {
  attempts: number;
  booking_id: string;
  id: string;
  max_attempts: number;
  operation:
    | "end_scheduled"
    | "end_hard_timeout"
    | "end_therapist_absent"
    | "reconcile_orphan"
    | "confirm_end";
  provider_session_id: string | null;
  video_session_id: string;
};

const runtime = getPaymentsRuntime("zoom-video-session-maintenance");
const DEFAULT_LIMIT = 10;

runtime.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    await requireInternalOperationsAccess(
      runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN"),
      request,
    );

    const config = getZoomVideoSdkConfig(runtime);
    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);

    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError(
        "missing_supabase_env",
        503,
        "Configuracao Supabase ausente.",
      );
    }

    const limit = getLimit(request);
    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const zoom = new ZoomVideoSdkApiClient({ config });

    const enqueued = await client.rpc<number>(
      "enqueue_due_video_session_control_jobs_v1",
      {
        p_environment: config.environment,
        p_limit: Math.min(limit * 3, 50),
        p_therapist_absence_grace_seconds:
          config.lifecycle.therapistReconnectGraceSeconds,
      },
    );
    const jobs = await client.rpc<ControlJob[]>(
      "reserve_video_session_control_jobs_v1",
      {
        p_environment: config.environment,
        p_limit: limit,
        p_lock_seconds: 90,
      },
    );

    const results = [];
    for (const job of jobs ?? []) {
      results.push(await processJob({ client, job, zoom }));
    }

    console.log(
      JSON.stringify({
        code: "ZOOM_VIDEO_MAINTENANCE_COMPLETED",
        durationMs: Date.now() - startedAt,
        enqueued,
        processed: results.length,
        requestId,
      }),
    );

    return success({ enqueued, processed: results.length, results });
  } catch (error) {
    console.error(
      JSON.stringify({
        code:
          error instanceof DomainError
            ? error.code
            : error instanceof ZoomVideoSdkError
              ? error.code
              : "ZOOM_VIDEO_MAINTENANCE_UNKNOWN",
        durationMs: Date.now() - startedAt,
        requestId,
      }),
    );

    if (error instanceof ZoomVideoSdkError) {
      return failure(
        new DomainError(error.code, error.status, "Manutencao Zoom falhou."),
        requestId,
      );
    }

    return failure(error, requestId);
  }
});

async function processJob(input: {
  client: SupabaseRestClient;
  job: ControlJob;
  zoom: ZoomVideoSdkApiClient;
}) {
  if (isLegacyReentrantControlOperation(input.job.operation)) {
    await completeJob(input.client, input.job.id, true);
    console.info(
      JSON.stringify({
        code: "ZOOM_VIDEO_CONTROL_JOB_SUPERSEDED",
        operation: input.job.operation,
      }),
    );
    return {
      ok: true,
      operation: input.job.operation,
      superseded: true,
    };
  }

  const reason = getTerminationReason(input.job.operation);

  try {
    await input.client.rpc("mark_video_session_termination_requested_v1", {
      p_reason: reason,
      p_video_session_id: input.job.video_session_id,
    });

    if (input.job.operation === "confirm_end") {
      await input.client.rpc("mark_video_session_termination_confirmed_v1", {
        p_reason: reason,
        p_video_session_id: input.job.video_session_id,
      });
      await completeJob(input.client, input.job.id, true);
      return { ok: true, operation: input.job.operation };
    }

    if (!input.job.provider_session_id) {
      const [session] = await input.client.get<
        Array<{ metadata: unknown; provider_session_id: string | null }>
      >(
        `/rest/v1/video_sessions?select=metadata,provider_session_id&id=eq.${encodeURIComponent(input.job.video_session_id)}&limit=1`,
      );
      if (
        session?.provider_session_id === null &&
        hasConfirmedProviderClosure(session.metadata)
      ) {
        await input.client.rpc("mark_video_session_termination_confirmed_v1", {
          p_reason: reason,
          p_video_session_id: input.job.video_session_id,
        });
        await completeJob(input.client, input.job.id, true);
        return { ok: true, operation: input.job.operation };
      }
      await completeJob(input.client, input.job.id, false, {
        code: "provider_session_id_missing",
        message: "Sessao ativa sem ID de provedor para encerramento REST.",
      });
      return { ok: false, operation: input.job.operation };
    }

    try {
      await input.zoom.endSession(input.job.provider_session_id);
    } catch (error) {
      if (!(error instanceof ZoomVideoSdkError && error.status === 404)) {
        throw error;
      }
    }

    await input.client.rpc("mark_video_session_termination_confirmed_v1", {
      p_reason: reason,
      p_video_session_id: input.job.video_session_id,
    });
    await completeJob(input.client, input.job.id, true);
    return { ok: true, operation: input.job.operation };
  } catch (error) {
    const status = error instanceof ZoomVideoSdkError ? error.status : 500;
    await completeJob(input.client, input.job.id, false, {
      code:
        error instanceof ZoomVideoSdkError
          ? error.code
          : "zoom_video_control_job_failed",
      message: sanitizeProviderMessage(error),
      retryAfterSeconds: status === 429 ? 60 : null,
    });
    return { ok: false, operation: input.job.operation };
  }
}

async function completeJob(
  client: SupabaseRestClient,
  jobId: string,
  success: boolean,
  error?: {
    code: string;
    message: string;
    retryAfterSeconds?: number | null;
  },
) {
  await client.rpc("complete_video_session_control_job_v1", {
    p_error_code: error?.code ?? null,
    p_error_message: error?.message ?? null,
    p_job_id: jobId,
    p_retry_after_seconds: error?.retryAfterSeconds ?? null,
    p_success: success,
  });
}

function getLimit(request: Request) {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isSafeInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, 25);
}

function getTerminationReason(operation: ControlJob["operation"]) {
  if (operation === "end_scheduled") return "scheduled_end";
  if (operation === "end_hard_timeout") return "hard_timeout";
  if (operation === "end_therapist_absent") return "therapist_absent";
  if (operation === "reconcile_orphan") return "reconcile_orphan";
  return "manual_end";
}

export {};
