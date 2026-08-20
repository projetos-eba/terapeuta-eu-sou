import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import {
  SupabaseHttpError,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import { requestEmailOutboxDispatch } from "../_shared/email/outbox-dispatch.ts";
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

    assertAdminCatalogPermission(user.role, permission);

    try {
      if (command.action === "list") {
        return success(
          await client.rpc("admin_list_therapy_catalog_v1", {
            p_actor_user_id: user.id,
          }),
        );
      }

      if (command.action === "requestList") {
        return success(await listCatalogRequests(client));
      }

      if (command.action === "requestSign") {
        return success(
          await signCatalogRequestMaterial(
            client,
            supabaseUrl,
            command.materialId,
          ),
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
        const result = await client.rpc<CatalogRequestDecisionResult>(
          "admin_decide_therapy_catalog_request_v2",
          {
            p_actor_user_id: user.id,
            p_catalog_request_id: command.catalogRequestId,
            p_decision: command.decision,
            p_related_therapy_id: command.relatedTherapyId,
            p_request_id: command.requestId,
            p_status: command.status,
          },
        );
        await requestEmailOutboxDispatch(runtime);
        return success(result);
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

async function listCatalogRequests(client: SupabaseRestClient) {
  const rows = await client.get<Array<CatalogRequestRow>>(
    "/rest/v1/therapy_catalog_requests?select=id,informed_name,description,justification,status,related_therapy_id,decision,created_at,updated_at,suggested_category_id,submission,therapy_catalog_request_materials(id,file_name,file_size_bytes,mime_type,created_at)&order=updated_at.desc",
  );

  return {
    requests: rows.map((row) => ({
      createdAt: row.created_at,
      decision: row.decision,
      description: row.description,
      id: row.id,
      informedName: row.informed_name,
      justification: row.justification,
      materials: row.therapy_catalog_request_materials ?? [],
      relatedTherapyId: row.related_therapy_id,
      status: row.status,
      submission: row.submission ?? {},
      suggestedCategoryId: row.suggested_category_id,
      updatedAt: row.updated_at,
    })),
  };
}

async function signCatalogRequestMaterial(
  client: SupabaseRestClient,
  supabaseUrl: string,
  materialId: string,
) {
  const rows = await client.get<Array<CatalogRequestMaterialRow>>(
    `/rest/v1/therapy_catalog_request_materials?select=id,file_name,storage_object_path&id=eq.${encodeURIComponent(materialId)}&limit=1`,
  );
  const material = rows[0];
  if (!material)
    throw new DomainError("not_found", 404, "Material não encontrado.");

  const objectPath = material.storage_object_path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const signed = await client.post<{ signedURL?: string; signedUrl?: string }>(
    `/storage/v1/object/sign/therapy-catalog-request-materials/${objectPath}`,
    { expiresIn: 120 },
  );
  const path = signed.signedURL ?? signed.signedUrl;
  if (!path)
    throw new DomainError(
      "unavailable",
      503,
      "Não foi possível abrir o material agora.",
    );

  const normalized = normalizeSignedStoragePath(path);
  return {
    fileName: material.file_name,
    url: new URL(normalized, supabaseUrl).toString(),
  };
}

function normalizeSignedStoragePath(value: string) {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.startsWith("/storage/v1/")
      ? parsed.pathname
      : `/storage/v1${parsed.pathname}`;
    return `${pathname}${parsed.search}`;
  } catch {
    const normalized = value.startsWith("/") ? value : `/${value}`;
    return normalized.startsWith("/storage/v1/")
      ? normalized
      : `/storage/v1${normalized}`;
  }
}

type CatalogRequestMaterialRow = {
  file_name: string;
  id: string;
  storage_object_path: string;
};

type CatalogRequestRow = {
  created_at: string;
  decision: string | null;
  description: string | null;
  id: string;
  informed_name: string;
  justification: string | null;
  related_therapy_id: string | null;
  status: string;
  submission: Record<string, unknown> | null;
  suggested_category_id: string | null;
  therapy_catalog_request_materials?: Array<{
    created_at: string;
    file_name: string;
    file_size_bytes: number;
    id: string;
    mime_type: string;
  }>;
  updated_at: string;
};

type CatalogRequestDecisionResult = {
  requestId: string;
  requesterUserId?: string;
  requestName?: string;
  requestStatus?: string;
};

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
