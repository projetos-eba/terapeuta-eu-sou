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
  assertAdminCatalogPermission,
  mapAdminTherapyCatalogDatabaseError,
  permissionForAdminTherapyCatalogCommand,
  type AdminTherapyCatalogCommandBody,
  validateAdminTherapyCatalogCommand,
} from "./catalog-command.ts";

const runtime = getRuntime("admin-therapy-catalog-command");

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
    const user = await requireUser(client, request);
    const command = validateAdminTherapyCatalogCommand(
      await parseJsonBody<AdminTherapyCatalogCommandBody>(request),
    );
    const permission = permissionForAdminTherapyCatalogCommand(command);

    if (command.action === "submitRequest") {
      return success(
        await client.rpc("submit_therapy_catalog_request_v1", {
          p_actor_user_id: user.id,
          p_payload: command.payload,
        }),
      );
    }

    assertAdminCatalogPermission(user.role, permission);

    try {
      if (command.action === "list") {
        return success(
          await client.rpc("admin_list_therapy_catalog_v1", {
            p_actor_user_id: user.id,
          }),
        );
      }

      if (command.action === "matchingList") {
        return success(
          await client.rpc("admin_list_matching_v1", {
            p_actor_user_id: user.id,
          }),
        );
      }

      if (command.action === "matchingSaveTheme") {
        return success(
          await client.rpc("admin_upsert_matching_theme_v1", {
            p_actor_user_id: user.id,
            p_payload: command.payload,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "matchingSaveInterest") {
        return success(
          await client.rpc("admin_upsert_matching_interest_v1", {
            p_actor_user_id: user.id,
            p_payload: command.payload,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "matchingTransition") {
        return success(
          await client.rpc("admin_transition_matching_entity_v1", {
            p_action: command.matchingAction,
            p_actor_user_id: user.id,
            p_entity_id: command.entityId,
            p_entity_type: command.entityType,
            p_reason: command.reason,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "impact") {
        return success(
          await client.rpc("admin_therapy_impact_v1", {
            p_actor_user_id: user.id,
            p_therapy_id: command.therapyId,
          }),
        );
      }

      if (command.action === "save") {
        return success(
          await client.rpc("admin_upsert_therapy_draft_with_matching_v1", {
            p_actor_user_id: user.id,
            p_payload: command.payload,
            p_request_id: command.requestId,
          }),
        );
      }

      if (command.action === "transition") {
        return success(
          await client.rpc("admin_transition_therapy_v1", {
            p_action: command.transition,
            p_actor_user_id: user.id,
            p_payload: command.payload,
            p_reason: command.reason,
            p_request_id: command.requestId,
            p_therapy_id: command.therapyId,
          }),
        );
      }

      if (command.action === "decideRequest") {
        return success(
          await client.rpc("admin_decide_therapy_catalog_request_v1", {
            p_actor_user_id: user.id,
            p_catalog_request_id: command.catalogRequestId,
            p_decision: command.decision,
            p_related_therapy_id: command.relatedTherapyId,
            p_request_id: command.requestId,
            p_status: command.status,
          }),
        );
      }

      throw new DomainError(
        "invalid_payload",
        422,
        "Revise os dados enviados.",
      );
    } catch (error) {
      logDatabaseFailure(error, correlationId);
      throw mapAdminTherapyCatalogDatabaseError(error);
    }
  } catch (error) {
    logFailure(error, correlationId, performance.now() - startedAt);
    return failure(error, correlationId);
  }
});

function logFailure(error: unknown, correlationId: string, durationMs: number) {
  console.error(
    JSON.stringify({
      actor_role: "admin",
      correlation_id: correlationId,
      duration_ms: Math.max(0, Math.round(durationMs)),
      error_code:
        error instanceof DomainError ? error.code : "admin_catalog_failed",
      operation: "admin_therapy_catalog_command",
    }),
  );
}

function logDatabaseFailure(error: unknown, correlationId: string) {
  if (!(error instanceof SupabaseHttpError)) return;

  console.error(
    JSON.stringify({
      correlation_id: correlationId,
      details: error.safeDetails,
      operation: "admin_therapy_catalog_command.database",
      status: error.status,
    }),
  );
}

export {};
