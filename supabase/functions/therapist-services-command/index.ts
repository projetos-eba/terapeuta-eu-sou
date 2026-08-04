import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import {
  SupabaseHttpError,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  mapTherapistServiceDatabaseError,
  type TherapistServicesCommandBody,
  validateTherapistServicesCommand,
} from "./service-command.ts";

const runtime = getRuntime("therapist-services-command");

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
    const command = validateTherapistServicesCommand(
      await parseJsonBody<TherapistServicesCommandBody>(request),
    );

    try {
      if (command.action === "catalog") {
        return success(
          await client.rpc("list_therapist_service_catalog_v1", {
            p_actor_user_id: user.id,
          }),
        );
      }

      if (command.action === "list") {
        return success(
          await client.rpc("list_private_therapist_services_v1", {
            p_actor_user_id: user.id,
          }),
        );
      }

      if (command.action === "create") {
        return success(
          await client.rpc("create_therapist_service_with_matching_v1", {
            p_actor_user_id: user.id,
            p_payload: command.payload,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "update") {
        return success(
          await client.rpc("update_therapist_service_with_matching_v1", {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_payload: command.payload,
            p_request_id: command.requestId,
            p_service_id: command.serviceId,
          }),
        );
      }

      if (
        command.action === "activate" ||
        command.action === "pause" ||
        command.action === "archive"
      ) {
        return success(
          await client.rpc("transition_therapist_service_v1", {
            p_action: command.action,
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
            p_service_id: command.serviceId,
          }),
        );
      }

      if (command.action === "reorder") {
        return success(
          await client.rpc("reorder_therapist_services_v1", {
            p_actor_user_id: user.id,
            p_request_id: command.requestId,
            p_service_ids: command.serviceIds,
          }),
        );
      }

      throw new DomainError(
        "invalid_payload",
        422,
        "Revise os dados do servico.",
      );
    } catch (error) {
      logDatabaseFailure(error, correlationId);
      throw mapTherapistServiceDatabaseError(error);
    }
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
      error_code:
        error instanceof DomainError ? error.code : "therapist_services_failed",
      operation: "therapist_services_command",
    }),
  );
}

function logDatabaseFailure(error: unknown, correlationId: string) {
  if (!(error instanceof SupabaseHttpError)) return;

  console.error(
    JSON.stringify({
      correlation_id: correlationId,
      details: error.safeDetails,
      operation: "therapist_services_command.database",
      status: error.status,
    }),
  );
}

export {};
