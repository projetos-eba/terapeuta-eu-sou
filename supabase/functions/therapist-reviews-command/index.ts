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
  mapTherapistReviewsDatabaseError,
  type TherapistReviewsCommandBody,
  validateTherapistReviewsCommand,
} from "./reviews-command.ts";

const runtime = getRuntime("therapist-reviews-command");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();

  try {
    if (request.method !== "POST") {
      throw new DomainError("METHOD_NOT_ALLOWED", 405, "Metodo nao permitido.");
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
    const command = validateTherapistReviewsCommand(
      await parseJsonBody<TherapistReviewsCommandBody>(request),
    );

    try {
      if (command.action === "reply") {
        return success(
          await client.rpc("upsert_therapist_review_reply_for_actor_v1", {
            p_actor_user_id: user.id,
            p_body: command.body,
            p_request_id: command.requestId,
            p_review_id: command.reviewId,
          }),
        );
      }

      throw new DomainError(
        "VALIDATION_ERROR",
        422,
        "Revise os dados da resposta.",
      );
    } catch (error) {
      logDatabaseFailure(error, correlationId, user.id);
      throw mapTherapistReviewsDatabaseError(error);
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
        error instanceof DomainError ? error.code : "therapist_reviews_failed",
      operation: "therapist_reviews_command",
    }),
  );
}

function logDatabaseFailure(
  error: unknown,
  correlationId: string,
  therapistUserId: string,
) {
  if (!(error instanceof SupabaseHttpError)) return;

  console.error(
    JSON.stringify({
      correlation_id: correlationId,
      details: error.safeDetails,
      operation: "therapist_reviews_command.database",
      status: error.status,
      therapist_user_id: therapistUserId,
    }),
  );
}

export {};
