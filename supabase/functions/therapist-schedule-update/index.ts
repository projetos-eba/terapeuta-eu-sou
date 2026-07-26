import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  mapScheduleDatabaseError,
  type ScheduleCommandBody,
  validateScheduleCommand,
} from "./schedule-command.ts";

type SaveResult = {
  idempotentReplay: boolean;
  scheduleVersion: number;
  timezone: string;
};

const runtime = getRuntime("therapist-schedule-update");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();

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

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const { user } = await requireTherapist(client, request);
    const body = validateScheduleCommand(
      await parseJsonBody<ScheduleCommandBody>(request),
    );

    let result: SaveResult;

    try {
      result = await client.rpc<SaveResult>("save_therapist_schedule_v1", {
        p_actor_user_id: user.id,
        p_expected_version: body.expectedVersion,
        p_request_id: body.requestId,
        p_rules: body.rules,
        p_service_settings: body.serviceSettings,
        p_timezone: body.timezone,
      });
    } catch (error) {
      throw mapScheduleDatabaseError(error);
    }

    return success(result);
  } catch (error) {
    logFailure(error, correlationId, performance.now() - startedAt);
    return failure(error, correlationId);
  }
});

function logFailure(error: unknown, correlationId: string, durationMs: number) {
  console.error(
    JSON.stringify({
      actor_role: "therapist",
      correlation_id: correlationId,
      duration_ms: Math.max(0, Math.round(durationMs)),
      error_code: error instanceof DomainError ? error.code : "schedule_update_failed",
      operation: "save_therapist_schedule_v1",
    }),
  );
}

export {};
