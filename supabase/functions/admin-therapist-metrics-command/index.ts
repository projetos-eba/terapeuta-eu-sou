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

type Body = {
  enabled?: unknown;
  reason?: unknown;
  requestId?: unknown;
};

type RuntimeChange = {
  applied: boolean;
  enabled: boolean;
  retentionDays: 120;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const runtime = getRuntime("admin-therapist-metrics-command");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Método não permitido.");
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey(runtime);
    if (!supabaseUrl || !serviceRoleKey) {
      throw new DomainError("unavailable", 503, "Serviço indisponível agora.");
    }

    const client = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
    const actor = await requireUser(client, request);
    // The current server-side admin permission contract grants
    // admin.settings.manage to the verified admin role. This guard is kept in
    // the Edge Function so direct calls cannot bypass administrative access.
    if (actor.role !== "admin") {
      throw new DomainError(
        "admin_settings_permission_required",
        403,
        "Ação administrativa não permitida.",
      );
    }

    const input = validateInput(await parseJsonBody<Body>(request));
    const result = await client.rpc<RuntimeChange>(
      "set_therapist_metrics_runtime_v1",
      {
        p_actor_user_id: actor.id,
        p_correlation_id: correlationId,
        p_enabled: input.enabled,
        p_reason: input.reason,
        p_request_id: input.requestId,
      },
    );

    return success({
      applied: result.applied,
      enabled: result.enabled,
      retentionDays: result.retentionDays,
    });
  } catch (error) {
    return failure(mapFailure(error), correlationId);
  }
});

function validateInput(body: Body) {
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const requestId =
    typeof body.requestId === "string" ? body.requestId.trim() : "";

  if (
    typeof body.enabled !== "boolean" ||
    reason.length < 8 ||
    reason.length > 500 ||
    !UUID_PATTERN.test(requestId)
  ) {
    throw new DomainError("invalid_request", 422, "Dados inválidos.");
  }

  return { enabled: body.enabled, reason, requestId };
}

function mapFailure(error: unknown) {
  if (error instanceof DomainError) return error;
  if (error instanceof SupabaseHttpError) {
    if (error.status === 401 || error.status === 403) {
      return new DomainError(
        "admin_settings_permission_required",
        403,
        "Ação administrativa não permitida.",
      );
    }

    if (error.status >= 400 && error.status < 500) {
      return new DomainError(
        "runtime_change_not_applied",
        409,
        "A coleta mudou antes desta ação ser concluída. Confira a situação e tente novamente.",
      );
    }
  }

  return new DomainError(
    "runtime_change_unavailable",
    503,
    "Não foi possível atualizar a coleta agora.",
  );
}
