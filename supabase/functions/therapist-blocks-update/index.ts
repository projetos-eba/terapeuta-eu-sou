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
  type BlockCommandBody,
  mapBlockDatabaseError,
  validateBlockCommand,
} from "./block-command.ts";

const runtime = getRuntime("therapist-blocks-update");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  let operation = "therapist_block_command";

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
    const command = validateBlockCommand(
      await parseJsonBody<BlockCommandBody>(request),
    );

    try {
      if (command.action === "create") {
        operation = "create_therapist_block_v2";
        return success(
          await client.rpc(operation, {
            p_actor_user_id: user.id,
            p_all_day: command.allDay,
            p_end_time: command.endTime,
            p_reason: command.reason,
            p_reason_code: command.reasonCode,
            p_recurrence_ends_on: command.recurrenceEndsOn,
            p_recurrence_frequency: command.recurrenceFrequency,
            p_request_id: command.requestId,
            p_service_id: command.serviceId,
            p_start_time: command.startTime,
            p_starts_on: command.startsOn,
            p_timezone: command.timezone,
          }),
        );
      }

      if (command.action === "cancel") {
        operation = "cancel_therapist_block_v1";
        return success(
          await client.rpc(operation, {
            p_actor_user_id: user.id,
            p_block_id: command.blockId,
            p_expected_schedule_version: command.expectedScheduleVersion,
            p_request_id: command.requestId,
            p_scope: command.scope,
          }),
        );
      }

      operation = "resolve_therapist_block_impact_v1";
      return success(
        await client.rpc(operation, {
          p_actor_user_id: user.id,
          p_impact_id: command.impactId,
          p_request_id: command.requestId,
          p_resolution: command.resolution,
        }),
      );
    } catch (error) {
      throw mapBlockDatabaseError(error);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        actor_role: "therapist",
        correlation_id: correlationId,
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        error_code: error instanceof DomainError ? error.code : "block_command_failed",
        operation,
      }),
    );
    return failure(error, correlationId);
  }
});

export {};
