import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import { requestEmailOutboxDispatch } from "../_shared/email/outbox-dispatch.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";

const runtime = getRuntime("therapy-catalog-request-command");
const bucket = "therapy-catalog-request-materials";
const maxFileSize = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type Action =
  | { action: "categories" }
  | { action: "list" }
  | { action: "submit"; payload: Record<string, unknown>; requestId: string }
  | {
      action: "resubmit";
      catalogRequestId: string;
      payload: Record<string, unknown>;
      requestId: string;
    }
  | {
      action: "upload";
      catalogRequestId: string;
      file: { base64: string; mimeType: string; name: string; size: number };
    }
  | {
      action: "sign";
      catalogRequestId: string;
      materialId: string;
    };

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();

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
    const { user } = await requireTherapist(client, request, {
      allowBlockedStatus: true,
    });
    const action = validateAction(await parseJsonBody<unknown>(request));

    if (action.action === "categories") {
      return success({ categories: await listCategories(client) });
    }

    if (action.action === "list") {
      return success({ requests: await listOwnRequests(client, user.id) });
    }

    if (action.action === "submit") {
      const result = await client.rpc<SubmissionResult>(
        "submit_therapy_catalog_request_v2",
        {
          p_actor_user_id: user.id,
          p_payload: action.payload,
          p_request_id: action.requestId,
        },
      );
      await requestEmailOutboxDispatch(runtime);
      return success(result);
    }

    if (action.action === "resubmit") {
      const result = await client.rpc<SubmissionResult>(
        "resubmit_therapy_catalog_request_v2",
        {
          p_actor_user_id: user.id,
          p_catalog_request_id: action.catalogRequestId,
          p_payload: action.payload,
          p_request_id: action.requestId,
        },
      );
      await requestEmailOutboxDispatch(runtime);
      return success(result);
    }

    const ownedRequest = await requireOwnRequest(
      client,
      user.id,
      action.catalogRequestId,
    );

    if (action.action === "upload") {
      if (!["submitted", "needs_information"].includes(ownedRequest.status)) {
        throw new DomainError(
          "not_editable",
          409,
          "Esta solicitação não aceita novos materiais neste momento.",
        );
      }
      const material = await uploadMaterial({
        action,
        client,
        requestId: ownedRequest.id,
        serviceRoleKey,
        supabaseUrl,
      });
      return success({ material });
    }

    const material = await requireOwnMaterial(
      client,
      ownedRequest.id,
      action.materialId,
    );
    if (!material.storage_object_path) {
      throw new DomainError(
        "unavailable",
        503,
        "Não foi possível abrir o material agora.",
      );
    }
    return success({
      signedPath: await signMaterial(
        client,
        material.file_name,
        material.storage_object_path,
      ),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        actor_role: "therapist",
        correlation_id: correlationId,
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        error_code:
          error instanceof DomainError
            ? error.code
            : "therapy_catalog_request_failed",
        operation: "therapy_catalog_request_command",
      }),
    );
    return failure(error, correlationId);
  }
});

function validateAction(value: unknown): Action {
  if (!isRecord(value) || typeof value.action !== "string") invalid();
  if (value.action === "categories" || value.action === "list")
    return { action: value.action };
  if (
    value.action === "submit" &&
    isRecord(value.payload) &&
    isUuid(value.requestId)
  ) {
    return {
      action: "submit",
      payload: value.payload,
      requestId: value.requestId,
    };
  }
  if (
    value.action === "resubmit" &&
    isRecord(value.payload) &&
    isUuid(value.requestId) &&
    isUuid(value.catalogRequestId)
  ) {
    return {
      action: "resubmit",
      catalogRequestId: value.catalogRequestId,
      payload: value.payload,
      requestId: value.requestId,
    };
  }
  if (
    value.action === "upload" &&
    isUuid(value.catalogRequestId) &&
    isRecord(value.file) &&
    typeof value.file.base64 === "string" &&
    typeof value.file.mimeType === "string" &&
    typeof value.file.name === "string" &&
    typeof value.file.size === "number"
  ) {
    return {
      action: "upload",
      catalogRequestId: value.catalogRequestId,
      file: {
        base64: value.file.base64,
        mimeType: value.file.mimeType,
        name: value.file.name,
        size: value.file.size,
      },
    };
  }
  if (
    value.action === "sign" &&
    isUuid(value.catalogRequestId) &&
    isUuid(value.materialId)
  ) {
    return {
      action: "sign",
      catalogRequestId: value.catalogRequestId,
      materialId: value.materialId,
    };
  }
  invalid();
}

function invalid(): never {
  throw new DomainError(
    "invalid_payload",
    422,
    "Revise as informações da solicitação.",
  );
}

async function listCategories(client: SupabaseRestClient) {
  return client.get<Array<{ id: string; name: string; slug: string }>>(
    "/rest/v1/therapy_categories?select=id,name,slug&is_active=eq.true&order=sort_order.asc,name.asc",
  );
}

async function listOwnRequests(client: SupabaseRestClient, userId: string) {
  const requests = await client.get<Array<RequestRow>>(
    `/rest/v1/therapy_catalog_requests?select=id,informed_name,status,decision,submission,suggested_category_id,created_at,updated_at,resubmitted_at&requester_profile_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
  );

  return Promise.all(
    requests.map(async (item) => ({
      createdAt: item.created_at,
      decision: item.decision,
      id: item.id,
      informedName: item.informed_name,
      materials: await listMaterials(client, item.id),
      status: item.status,
      submission: item.submission,
      suggestedCategoryId: item.suggested_category_id,
      updatedAt: item.updated_at,
    })),
  );
}

async function requireOwnRequest(
  client: SupabaseRestClient,
  userId: string,
  requestId: string,
) {
  const rows = await client.get<Array<RequestRow>>(
    `/rest/v1/therapy_catalog_requests?select=id,status&requester_profile_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(requestId)}&limit=1`,
  );
  const item = rows[0];
  if (!item) {
    throw new DomainError("not_found", 404, "Solicitação não encontrada.");
  }
  return item;
}

async function uploadMaterial({
  action,
  client,
  requestId,
  serviceRoleKey,
  supabaseUrl,
}: {
  action: Extract<Action, { action: "upload" }>;
  client: SupabaseRestClient;
  requestId: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}) {
  const file = action.file;
  if (
    !allowedMimeTypes.has(file.mimeType) ||
    !Number.isInteger(file.size) ||
    file.size < 1 ||
    file.size > maxFileSize ||
    file.name.trim().length < 1 ||
    file.name.length > 180
  ) {
    throw new DomainError(
      "invalid_file",
      422,
      "Envie um arquivo permitido de até 10 MB.",
    );
  }

  const bytes = decodeBase64(file.base64);
  if (bytes.byteLength !== file.size) {
    throw new DomainError(
      "invalid_file",
      422,
      "Não foi possível validar este arquivo.",
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  const objectPath = `${requestId}/${crypto.randomUUID()}-${safeName}`;
  const upload = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,
    {
      body: bytes,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": file.mimeType,
        "x-upsert": "false",
      },
      method: "POST",
    },
  );
  if (!upload.ok) {
    throw new DomainError(
      "upload_failed",
      503,
      "Não foi possível enviar o material agora.",
    );
  }

  const rows = await client.post<Array<MaterialRow>>(
    "/rest/v1/therapy_catalog_request_materials",
    {
      file_name: file.name.trim(),
      file_size_bytes: file.size,
      mime_type: file.mimeType,
      storage_object_path: objectPath,
      therapy_catalog_request_id: requestId,
    },
    "return=representation",
  );
  return toMaterial(rows[0]);
}

async function listMaterials(client: SupabaseRestClient, requestId: string) {
  const rows = await client.get<Array<MaterialRow>>(
    `/rest/v1/therapy_catalog_request_materials?select=id,file_name,file_size_bytes,mime_type,created_at&therapy_catalog_request_id=eq.${encodeURIComponent(requestId)}&order=created_at.asc`,
  );
  return rows.map(toMaterial);
}

async function requireOwnMaterial(
  client: SupabaseRestClient,
  requestId: string,
  materialId: string,
) {
  const rows = await client.get<Array<MaterialRow>>(
    `/rest/v1/therapy_catalog_request_materials?select=id,file_name,file_size_bytes,mime_type,storage_object_path,created_at&therapy_catalog_request_id=eq.${encodeURIComponent(requestId)}&id=eq.${encodeURIComponent(materialId)}&limit=1`,
  );
  if (!rows[0])
    throw new DomainError("not_found", 404, "Material não encontrado.");
  return rows[0];
}

async function signMaterial(
  client: SupabaseRestClient,
  fileName: string,
  objectPath: string,
) {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const signed = await client.post<{ signedURL?: string; signedUrl?: string }>(
    `/storage/v1/object/sign/${bucket}/${encodedPath}`,
    { expiresIn: 120 },
  );
  const path = signed.signedURL ?? signed.signedUrl;
  if (!path)
    throw new DomainError(
      "unavailable",
      503,
      "Não foi possível abrir o material agora.",
    );
  return { fileName, url: path };
}

function decodeBase64(value: string) {
  const source = value.includes(",")
    ? value.slice(value.indexOf(",") + 1)
    : value;
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toMaterial(item: MaterialRow | undefined) {
  if (!item)
    throw new DomainError(
      "unavailable",
      503,
      "Não foi possível registrar o material.",
    );
  return {
    createdAt: item.created_at,
    fileName: item.file_name,
    fileSizeBytes: item.file_size_bytes,
    id: item.id,
    mimeType: item.mime_type,
  };
}

type SubmissionResult = {
  contractVersion: number;
  idempotentReplay?: boolean;
  requestId: string;
  status: string;
};

type RequestRow = {
  created_at?: string;
  decision?: string | null;
  id: string;
  informed_name?: string;
  status: string;
  submission?: Record<string, unknown>;
  suggested_category_id?: string | null;
  updated_at?: string;
};

type MaterialRow = {
  created_at: string;
  file_name: string;
  file_size_bytes: number;
  id: string;
  mime_type: string;
  storage_object_path?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
