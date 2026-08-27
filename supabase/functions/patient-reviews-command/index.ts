import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import {
  mapPatientReviewDatabaseError,
  type PatientReviewCommandBody,
  validatePatientReviewCommand,
} from "./review-command.ts";

const runtime = getRuntime("patient-reviews-command");

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
    const command = validatePatientReviewCommand(
      await parseJsonBody<PatientReviewCommandBody>(request),
    );

    try {
      return success(
        await client.rpc("save_patient_therapist_review_for_actor_v1", {
          p_action: command.action,
          p_actor_user_id: user.id,
          p_comment: command.comment,
          p_rating: command.rating,
          p_request_id: command.requestId,
          p_therapist_profile_id: command.therapistProfileId,
        }),
      );
    } catch (error) {
      throw mapPatientReviewDatabaseError(error);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        code: error instanceof DomainError ? error.code : "patient_review_failed",
        correlation_id: correlationId,
        operation: "patient_reviews_command",
      }),
    );
    return failure(error, correlationId);
  }
});

export {};
