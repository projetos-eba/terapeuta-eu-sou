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
  mapTherapistProfileDatabaseError,
  type TherapistProfileCommandBody,
  validateTherapistProfileCommand,
} from "./profile-command.ts";

const runtime = getRuntime("therapist-profile-command");

type PublishCommandResult = {
  contractVersion?: number;
  editor?: unknown;
  idempotentReplay?: boolean;
};

type SlugAvailabilityResult = {
  normalizedSlug: string;
  status: "available" | "current" | "invalid" | "reserved" | "taken";
};

type EditorReadResult = {
  therapistProfileId?: string;
} & Record<string, unknown>;

type PrivateDocumentRecord = {
  created_at: string;
  document_kind: string;
  file_name: string;
  file_size_bytes: number;
  id: string;
  mime_type: string;
  review_note?: string | null;
  reviewed_at?: string | null;
  status: string;
  updated_at: string;
  validation_state: string;
};

type PrivateIdentityRecord = {
  city?: string | null;
  document_number?: string | null;
  neighborhood?: string | null;
  postal_code?: string | null;
  state?: string | null;
  street?: string | null;
  street_number?: string | null;
};

type TherapistProfileRecord = {
  id: string;
  is_public: boolean;
  public_status: string;
  status: string;
};

type TherapistVerificationRecord = {
  changes_requested?: string | null;
  id: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  status: string;
  submitted_at?: string | null;
};

type EnrichedEditorReadStage =
  | "editor_read"
  | "private_documents_read"
  | "verification_summary_read";

class EnrichedEditorReadError extends Error {
  constructor(
    readonly stage: EnrichedEditorReadStage,
    readonly sourceError: unknown,
  ) {
    super("THERAPIST_PROFILE_ENRICHED_READ_FAILED");
  }
}

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

    const contentType = request.headers.get("content-type") ?? "";

    try {
      if (contentType.includes("multipart/form-data")) {
        return success(
          await handlePrivateDocumentUpload({
            client,
            request,
            serviceRoleKey,
            supabaseUrl,
            userId: user.id,
          }),
        );
      }

      const command = validateTherapistProfileCommand(
        await parseJsonBody<TherapistProfileCommandBody>(request),
      );

      if (command.action === "read") {
        return success(await readEnrichedEditor(client, user.id));
      }

      if (command.action === "check_slug_availability") {
        return success(
          await client.rpc<SlugAvailabilityResult>(
            "check_therapist_public_slug_availability_v1",
            { p_actor_user_id: user.id, p_slug: command.slug },
          ),
        );
      }

      if (command.action === "update_slug") {
        const result = await client.rpc<PublishCommandResult>(
          "update_therapist_public_slug_v1",
          {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
            p_slug: command.slug,
          },
        );
        return success({
          contractVersion: result.contractVersion ?? 2,
          editor: await readEnrichedEditor(client, user.id),
          idempotentReplay: Boolean(result.idempotentReplay),
        });
      }

      if (command.action === "save_draft") {
        if (command.preserveLegacyVideoUrl) {
          await assertLegacyVideoUrlIsUnchanged(
            client,
            user.id,
            command.payload,
          );
        }

        const result = await client.rpc<PublishCommandResult>(
          "save_therapist_profile_draft_v1",
          {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_payload: command.payload,
            p_request_id: command.requestId,
          },
        );

        return success({
          contractVersion: result.contractVersion ?? 1,
          editor: await readEnrichedEditor(client, user.id),
          idempotentReplay: Boolean(result.idempotentReplay),
        });
      }

      if (command.action === "save_media_draft") {
        const result = await client.rpc<PublishCommandResult>(
          "save_therapist_profile_media_draft_v1",
          {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_kind: command.kind,
            p_media_url: command.mediaUrl,
            p_request_id: command.requestId,
          },
        );

        return success({
          contractVersion: result.contractVersion ?? 1,
          editor: await readEnrichedEditor(client, user.id),
          idempotentReplay: Boolean(result.idempotentReplay),
        });
      }

      if (command.action === "discard_draft") {
        const result = await client.rpc<PublishCommandResult>(
          "discard_therapist_profile_draft_v1",
          {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          },
        );

        return success({
          contractVersion: result.contractVersion ?? 1,
          editor: await readEnrichedEditor(client, user.id),
          idempotentReplay: Boolean(result.idempotentReplay),
        });
      }

      if (command.action === "publish") {
        await assertPublicationRequirements(client, user.id);

        const publishResult = await client.rpc<PublishCommandResult>(
          "publish_therapist_profile_draft_v1",
          {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          },
        );

        try {
          await syncVerificationReviewQueue(client, user.id);
        } catch (syncError) {
          logVerificationSyncWarning(syncError, correlationId);
        }

        return success({
          contractVersion: publishResult.contractVersion ?? 1,
          editor: await readEnrichedEditor(client, user.id),
          idempotentReplay: Boolean(publishResult.idempotentReplay),
        });
      }

      if (command.action === "unpublish") {
        const result = await client.rpc<PublishCommandResult>(
          "unpublish_therapist_profile_v1",
          {
            p_actor_user_id: user.id,
            p_expected_version: command.expectedVersion,
            p_request_id: command.requestId,
          },
        );

        return success({
          contractVersion: result.contractVersion ?? 1,
          editor: await readEnrichedEditor(client, user.id),
          idempotentReplay: Boolean(result.idempotentReplay),
        });
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

async function readEnrichedEditor(client: SupabaseRestClient, userId: string) {
  let editor: EditorReadResult;

  try {
    editor = (await client.rpc<EditorReadResult>(
      "get_private_therapist_profile_editor_v1",
      {
        p_actor_user_id: userId,
      },
    )) as EditorReadResult;
  } catch (error) {
    throw new EnrichedEditorReadError("editor_read", error);
  }
  const therapistProfileId = String(editor.therapistProfileId ?? "");

  if (!therapistProfileId) {
    return {
      ...editor,
      privateDocuments: [],
      privateLocation: null,
      verificationSummary: null,
    };
  }

  const [
    privateDocumentsResult,
    privateLocationResult,
    verificationSummaryResult,
  ] = await Promise.allSettled([
    readPrivateDocuments(client, therapistProfileId),
    readPrivateLocation(client, therapistProfileId),
    readVerificationSummary(client, therapistProfileId),
  ]);

  if (privateDocumentsResult.status === "rejected") {
    throw new EnrichedEditorReadError(
      "private_documents_read",
      privateDocumentsResult.reason,
    );
  }

  if (verificationSummaryResult.status === "rejected") {
    throw new EnrichedEditorReadError(
      "verification_summary_read",
      verificationSummaryResult.reason,
    );
  }

  return {
    ...editor,
    privateDocuments: privateDocumentsResult.value,
    privateLocation:
      privateLocationResult.status === "fulfilled"
        ? privateLocationResult.value
        : null,
    verificationSummary: verificationSummaryResult.value,
  };
}

async function assertLegacyVideoUrlIsUnchanged(
  client: SupabaseRestClient,
  userId: string,
  payload: { videoProvider: string; videoUrl: string | null },
) {
  const editor = (await client.rpc<EditorReadResult>(
    "get_private_therapist_profile_editor_v1",
    { p_actor_user_id: userId },
  )) as EditorReadResult;
  const source =
    readEditorVideo(editor.draft) ?? readEditorVideo(editor.published);

  if (
    payload.videoProvider !== "external" ||
    !payload.videoUrl ||
    !isHttpsUrl(payload.videoUrl) ||
    !source ||
    source.videoProvider !== "external" ||
    source.videoUrl !== payload.videoUrl
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      422,
      "Use um link https:// do YouTube ou Vimeo, ou envie um vídeo válido.",
    );
  }
}

function readEditorVideo(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const fields = (value as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object") return null;
  const videoUrl = (fields as { videoUrl?: unknown }).videoUrl;
  const videoProvider = (fields as { videoProvider?: unknown }).videoProvider;
  return typeof videoUrl === "string" && typeof videoProvider === "string"
    ? { videoProvider, videoUrl }
    : null;
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function readPrivateLocation(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const rows = await client.get<PrivateIdentityRecord[]>(
    `/rest/v1/therapist_private_identity?therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&select=city,state&limit=1`,
  );
  const identity = rows[0];

  return {
    city: normalizeNullableText(identity?.city) ?? "",
    state: normalizeNullableText(identity?.state) ?? "",
  };
}

async function handlePrivateDocumentUpload({
  client,
  request,
  serviceRoleKey,
  supabaseUrl,
  userId,
}: {
  client: SupabaseRestClient;
  request: Request;
  serviceRoleKey: string;
  supabaseUrl: string;
  userId: string;
}) {
  const formData = await request.formData();
  const action = formData.get("action");
  const kind = formData.get("kind");
  const file = formData.get("file");

  if (
    action !== "upload_document" ||
    !isDocumentKind(kind) ||
    !isFileUpload(file)
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      422,
      "Envie um documento válido.",
    );
  }

  await validatePrivateDocument(file);

  const editor = await readEnrichedEditor(client, userId);
  const therapistProfileId = String(editor.therapistProfileId ?? "");

  if (!therapistProfileId) {
    throw new DomainError(
      "PROFILE_NOT_FOUND",
      404,
      "Perfil profissional não encontrado.",
    );
  }

  const existingDocuments = await readPrivateDocuments(
    client,
    therapistProfileId,
  );
  const activeDocuments = existingDocuments.filter(
    (document) => document.kind === kind && document.status !== "archived",
  );

  for (const document of activeDocuments) {
    await client.patch(
      `/rest/v1/therapist_private_documents?id=eq.${encodeURIComponent(document.id)}`,
      {
        status: "archived",
        updated_at: new Date().toISOString(),
      },
      "return=minimal",
    );
  }

  const objectPath = `${userId}/documents/${kind}-${crypto.randomUUID()}${extensionFor(file.type)}`;
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/therapist-private-documents/${objectPath}`,
    {
      body: file,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      method: "POST",
    },
  );

  if (!uploadResponse.ok) {
    throw new DomainError(
      "UNAVAILABLE",
      502,
      "Não foi possível enviar o documento agora.",
    );
  }

  const insertedRows = await client.post<PrivateDocumentRecord[]>(
    "/rest/v1/therapist_private_documents",
    {
      document_kind: kind,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      status: "uploaded",
      storage_object_path: objectPath,
      therapist_profile_id: therapistProfileId,
      uploaded_by: userId,
      validation_state: "not_scanned",
    },
    "return=representation",
  );

  const inserted = Array.isArray(insertedRows) ? insertedRows[0] : null;

  if (!inserted) {
    throw new DomainError(
      "UNAVAILABLE",
      502,
      "Não foi possível registrar o documento enviado.",
    );
  }

  return {
    document: mapPrivateDocumentRecord(inserted),
    documents: await readPrivateDocuments(client, therapistProfileId),
    verificationSummary: await readVerificationSummary(
      client,
      therapistProfileId,
    ),
  };
}

function logFailure(error: unknown, correlationId: string, durationMs: number) {
  const sourceError =
    error instanceof EnrichedEditorReadError ? error.sourceError : error;

  console.error(
    JSON.stringify({
      actor_role: "therapist",
      correlation_id: correlationId,
      duration_ms: Math.max(0, Math.round(durationMs)),
      error_code:
        error instanceof DomainError ? error.code : "therapist_profile_failed",
      failure_stage:
        error instanceof EnrichedEditorReadError ? error.stage : undefined,
      source_http_status:
        sourceError instanceof SupabaseHttpError
          ? sourceError.status
          : undefined,
      operation: "therapist_profile_command",
    }),
  );
}

async function syncVerificationReviewQueue(
  client: SupabaseRestClient,
  userId: string,
) {
  const therapistProfiles = await client.get<TherapistProfileRecord[]>(
    `/rest/v1/therapist_profiles?user_id=eq.${encodeURIComponent(
      userId,
    )}&select=id,status,public_status,is_public&limit=1`,
  );
  const profile = therapistProfiles[0];

  if (!profile || profile.public_status !== "published" || !profile.is_public) {
    return;
  }

  const verificationRows = await client.get<TherapistVerificationRecord[]>(
    `/rest/v1/therapist_verifications?therapist_profile_id=eq.${profile.id}&select=id,status&order=submitted_at.desc.nullslast,created_at.desc&limit=1`,
  );
  const latestVerification = verificationRows[0];

  if (!latestVerification) {
    await client.post(
      "/rest/v1/therapist_verifications",
      {
        therapist_profile_id: profile.id,
      },
      "return=minimal",
    );
    await ensureProfileReviewStatus(client, profile.id, profile.status);
    return;
  }

  if (
    latestVerification.status === "changes_requested" ||
    latestVerification.status === "draft" ||
    latestVerification.status === "rejected"
  ) {
    await client.patch(
      `/rest/v1/therapist_verifications?id=eq.${latestVerification.id}`,
      {
        changes_requested: null,
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      "return=minimal",
    );
    await ensureProfileReviewStatus(client, profile.id, profile.status);
    return;
  }

  if (
    profile.status === "draft" ||
    profile.status === "changes_requested" ||
    profile.status === "rejected"
  ) {
    await ensureProfileReviewStatus(client, profile.id, profile.status);
  }
}

async function readPrivateDocuments(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const rows = await client.get<PrivateDocumentRecord[]>(
    `/rest/v1/therapist_private_documents?therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&status=neq.archived&select=id,document_kind,file_name,mime_type,file_size_bytes,status,validation_state,review_note,reviewed_at,created_at,updated_at&order=created_at.desc`,
  );

  const latestByKind = new Map<
    string,
    ReturnType<typeof mapPrivateDocumentRecord>
  >();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!latestByKind.has(row.document_kind)) {
      latestByKind.set(row.document_kind, mapPrivateDocumentRecord(row));
    }
  }

  return Array.from(latestByKind.values());
}

async function assertPublicationRequirements(
  client: SupabaseRestClient,
  userId: string,
) {
  const editor = (await client.rpc<EditorReadResult>(
    "get_private_therapist_profile_editor_v1",
    { p_actor_user_id: userId },
  )) as EditorReadResult;
  const therapistProfileId = String(editor.therapistProfileId ?? "");

  if (!therapistProfileId) {
    throw new DomainError(
      "PROFILE_NOT_FOUND",
      404,
      "Perfil profissional não encontrado.",
    );
  }

  const [identityRows, documents] = await Promise.all([
    client.get<PrivateIdentityRecord[]>(
      `/rest/v1/therapist_private_identity?therapist_profile_id=eq.${encodeURIComponent(therapistProfileId)}&select=city,document_number,neighborhood,postal_code,state,street,street_number&limit=1`,
    ),
    readPrivateDocuments(client, therapistProfileId),
  ]);
  const identity = identityRows[0];
  const identityComplete = Boolean(
    identity &&
    identity.document_number?.trim() &&
    identity.postal_code?.trim() &&
    identity.street?.trim() &&
    identity.street_number?.trim() &&
    identity.neighborhood?.trim() &&
    identity.city?.trim() &&
    identity.state?.trim(),
  );
  const documentsComplete = ["identity_document", "address_proof"].every(
    (kind) =>
      documents.some(
        (document) => document.kind === kind && document.status !== "rejected",
      ),
  );

  if (!identityComplete || !documentsComplete) {
    throw new DomainError(
      "PROFILE_REQUIREMENTS_INCOMPLETE",
      422,
      "Complete seus dados e envie os documentos obrigatórios em Configurações antes de publicar seu perfil.",
    );
  }
}

async function readVerificationSummary(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const rows = await client.get<TherapistVerificationRecord[]>(
    `/rest/v1/therapist_verifications?therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&select=id,status,submitted_at,reviewed_at,changes_requested,rejection_reason&order=submitted_at.desc.nullslast,created_at.desc&limit=1`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row?.id) return null;

  return {
    changesRequested: normalizeNullableText(row.changes_requested),
    id: row.id,
    rejectionReason: normalizeNullableText(row.rejection_reason),
    reviewedAt: row.reviewed_at ?? null,
    status: normalizeVerificationStatus(row.status),
    submittedAt: row.submitted_at ?? null,
  };
}

async function ensureProfileReviewStatus(
  client: SupabaseRestClient,
  profileId: string,
  currentStatus: string,
) {
  if (
    currentStatus === "approved" ||
    currentStatus === "in_review" ||
    currentStatus === "submitted" ||
    currentStatus === "suspended"
  ) {
    return;
  }

  await client.patch(
    `/rest/v1/therapist_profiles?id=eq.${profileId}`,
    {
      status: "submitted",
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );
}

function logVerificationSyncWarning(error: unknown, correlationId: string) {
  console.error(
    JSON.stringify({
      actor_role: "therapist",
      correlation_id: correlationId,
      error_code:
        error instanceof DomainError
          ? error.code
          : "therapist_profile_verification_sync_failed",
      operation: "therapist_profile_verification_sync",
    }),
  );
}

function isDocumentKind(value: FormDataEntryValue | null): value is string {
  return value === "address_proof" || value === "identity_document";
}

function isFileUpload(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

async function validatePrivateDocument(file: File) {
  if (
    file.type !== "application/pdf" &&
    file.type !== "image/jpeg" &&
    file.type !== "image/png" &&
    file.type !== "image/webp"
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      422,
      "Envie um arquivo em PDF, JPG, PNG ou WebP.",
    );
  }

  if (file.size < 1 || file.size > 10 * 1024 * 1024) {
    throw new DomainError(
      "VALIDATION_ERROR",
      422,
      "Não foi possível concluir a operação. Tamanho do arquivo excede o limite de 10 MB.",
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const valid =
    (file.type === "application/pdf" && hasAscii(bytes, 0, "%PDF")) ||
    (file.type === "image/jpeg" && hasPrefix(bytes, [0xff, 0xd8, 0xff])) ||
    (file.type === "image/png" &&
      hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.type === "image/webp" &&
      hasAscii(bytes, 0, "RIFF") &&
      hasAscii(bytes, 8, "WEBP"));

  if (!valid) {
    throw new DomainError(
      "VALIDATION_ERROR",
      422,
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
  }
}

function mapPrivateDocumentRecord(row: PrivateDocumentRecord) {
  return {
    createdAt: row.created_at,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    id: row.id,
    kind: normalizeDocumentKind(row.document_kind),
    mimeType: row.mime_type,
    reviewNote: normalizeNullableText(row.review_note),
    reviewedAt: row.reviewed_at ?? null,
    status: normalizeDocumentStatus(row.status),
    updatedAt: row.updated_at,
    validationState: normalizeValidationState(row.validation_state),
  };
}

function extensionFor(contentType: string) {
  if (contentType === "application/pdf") return ".pdf";
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  return "";
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function hasAscii(bytes: Uint8Array, offset: number, value: string) {
  return Array.from(value).every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  );
}

function normalizeDocumentKind(value: string) {
  return value === "address_proof" ? "address_proof" : "identity_document";
}

function normalizeDocumentStatus(value: string) {
  if (
    value === "accepted" ||
    value === "archived" ||
    value === "rejected" ||
    value === "uploaded"
  ) {
    return value;
  }

  return "uploaded";
}

function normalizeValidationState(value: string) {
  if (
    value === "failed" ||
    value === "not_scanned" ||
    value === "passed" ||
    value === "pending"
  ) {
    return value;
  }

  return "not_scanned";
}

function normalizeVerificationStatus(value: string) {
  if (
    value === "approved" ||
    value === "changes_requested" ||
    value === "draft" ||
    value === "in_review" ||
    value === "rejected" ||
    value === "submitted" ||
    value === "suspended"
  ) {
    return value;
  }

  return "none";
}

function normalizeNullableText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export {};
