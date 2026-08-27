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
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import {
  mapSessionFeedbackDatabaseError,
  type SessionFeedbackCommandBody,
  validateSessionFeedbackCommand,
} from "./feedback-command.ts";

const runtime = getRuntime("session-feedback-command");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("METHOD_NOT_ALLOWED", 405, "Método não permitido.");
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);
    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError("UNAVAILABLE", 503, "Configuração indisponível.");
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const user = await requireUser(client, request);
    const command = validateSessionFeedbackCommand(
      await parseJsonBody<SessionFeedbackCommandBody>(request),
    );

    try {
      const result = await client.rpc(
        "submit_session_feedback_for_actor_v1",
        {
          p_actor_user_id: user.id,
          p_booking_id: command.bookingId,
          p_comment: command.comment,
          p_not_performed_reason: command.notPerformedReason,
          p_outcome: command.outcome,
          p_rating: command.rating,
          p_request_id: command.requestId,
        },
      );

      return success(result);
    } catch (error) {
      logDatabaseFailure(error, correlationId, user.id);
      throw mapSessionFeedbackDatabaseError(error);
    }
  } catch (error) {
    logFailure(error, correlationId);
    return failure(error, correlationId);
  }
});

function logFailure(error: unknown, correlationId: string) {
  console.error(
    JSON.stringify({
      code: error instanceof DomainError ? error.code : "session_feedback_failed",
      correlation_id: correlationId,
      operation: "session_feedback_command",
    }),
  );
}

function logDatabaseFailure(error: unknown, correlationId: string, userId: string) {
  if (!(error instanceof SupabaseHttpError)) return;

  console.error(
    JSON.stringify({
      correlation_id: correlationId,
      details: error.safeDetails,
      operation: "session_feedback_command.database",
      status: error.status,
      user_id: userId,
    }),
  );
}
