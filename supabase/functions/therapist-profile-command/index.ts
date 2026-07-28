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
  mapTherapistProfileDatabaseError,
  type TherapistProfileCommandBody,
  validateTherapistProfileCommand,
} from "./profile-command.ts";

const runtime = getRuntime("therapist-profile-command");

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
        "UNAVAILABLE",
        503,
        "Configuracao Supabase ausente.",
      );
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const { user } = await requireTherapist(client, request, {
      allowBlockedStatus: false,
    });
    const command = validateTherapistProfileCommand(
      await parseJsonBody<TherapistProfileCommandBody>(request),
    );

    try {
      if (command.action === "read") {
        return success(
          await client.rpc("get_private_therapist_profile_editor_v1", {
            p_actor_user_id: user.id,
          }),
        );
      }

      if (command.action === "save_draft") {
        return success(
          await client.rpc("save_therapist_profile_draft_v1", {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_payload: command.payload,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "discard_draft") {
        return success(
          await client.rpc("discard_therapist_profile_draft_v1", {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "publish") {
        return success(
          await client.rpc("publish_therapist_profile_draft_v1", {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "unpublish") {
        return success(
          await client.rpc("unpublish_therapist_profile_v1", {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          }),
        );
      }

      throw new DomainError(
        "VALIDATION_ERROR",
        422,
        "Revise os dados do perfil.",
      );
    } catch (error) {
      throw mapTherapistProfileDatabaseError(error);
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
        error instanceof DomainError ? error.code : "therapist_profile_failed",
      operation: "therapist_profile_command",
    }),
  );
}

export {};
