import { handleOptions } from "../_shared/auth/cors.ts";
import { getRuntime, getServiceRoleKey } from "../_shared/auth/runtime.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireTherapist,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import {
  fileExtension,
  parseTherapistPrivateDocumentsAction,
  requiredDocumentDefinition,
  type TherapistPrivateDocumentKind,
  validatePrivateDocumentUpload,
} from "./document-command.ts";

const runtime = getRuntime("therapist-private-documents");
const bucket = "therapist-private-documents";

type TherapistProfileRecord = {
  created_at: string;
  id: string;
  is_accepting_bookings: boolean;
  is_public: boolean;
  last_published_at: string | null;
  public_status: string;
  status: string;
  user_id: string;
};

type VerificationRecord = {
  created_at: string;
  id: string;
  reviewed_at: string | null;
  status: string;
  submitted_at: string | null;
  updated_at: string;
};

type PrivateDocumentRow = {
  created_at: string;
  document_kind: string;
  file_name: string;
  file_size_bytes: number;
  id: string;
  mime_type: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  status: string;
  storage_object_path: string;
  updated_at: string;
  validation_state: string;
};

type LegacyPrivateDocumentSummary = {
  createdAt: string;
  fileName: string;
  fileSizeBytes: number;
  id: string;
  kind: "address_proof" | "identity_document";
  mimeType: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  status: "accepted" | "rejected" | "uploaded";
  updatedAt: string;
  validationState: "failed" | "not_scanned" | "passed" | "pending";
};

type PublicationEligibility = {
  blockers?: unknown;
  eligible?: boolean;
};

type TherapistEditorReadModel = {
  derived?: {
    activeServiceCount?: number;
    availabilityRuleCount?: number;
    publicStatus?: string;
    verificationStatus?: string;
  };
  draft?: { fields?: Record<string, unknown> | null } | null;
  published?: { fields?: Record<string, unknown> | null } | null;
};

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
    const action = await parseTherapistPrivateDocumentsAction(request);

    if (
      action.action === "therapist.read" ||
      action.action === "therapist.sign" ||
      action.action === "therapist.upload"
    ) {
      const { profile, user } = await requireTherapist(client, request, {
        allowBlockedStatus: true,
      });

      if (action.action === "therapist.read") {
        return success(
          await buildTherapistDocumentCenter(client, profile.id, user.id),
        );
      }

      if (action.action === "therapist.sign") {
        const document = await requireDocument(client, {
          documentId: action.documentId,
          therapistProfileId: profile.id,
        });

        return success({
          signedPath: await createSignedDocumentPath({
            client,
            disposition: action.disposition,
            fileName: document.file_name,
            objectPath: document.storage_object_path,
          }),
        });
      }

      if (action.action !== "therapist.upload") {
        throw new DomainError("VALIDATION_ERROR", 422, "Ação inválida.");
      }

      const document = await storeTherapistDocument({
        client,
        file: action.file,
        kind: action.kind,
        serviceRoleKey,
        supabaseUrl,
        therapistProfileId: profile.id,
        userId: user.id,
      });

      const [documentCenter, documents, verification] = await Promise.all([
        buildTherapistDocumentCenter(client, profile.id, user.id),
        listLatestLegacyDocuments(client, profile.id),
        readLatestVerification(client, profile.id),
      ]);

      return success({
        document: toLegacyDocumentSummary(document),
        documentCenter,
        documents,
        verificationStatus: verification?.status ?? "draft",
      });
    }

    const admin = await requireUser(client, request);
    if (admin.role !== "admin") {
      throw new DomainError(
        "FORBIDDEN",
        403,
        "Entre com uma conta administrativa para continuar.",
      );
    }

    if (action.action === "admin.read") {
      return success(
        await buildAdminDocumentReview(client, action.therapistProfileId),
      );
    }

    if (action.action === "admin.review") {
      const document = await requireDocument(client, {
        documentId: action.documentId,
        therapistProfileId: action.therapistProfileId,
      });
      const reviewedDocument = await reviewPrivateDocument({
        action,
        actorUserId: admin.id,
        client,
        document,
      });
      const verification = await readLatestVerification(
        client,
        action.therapistProfileId,
      );

      return success({
        document: mapDocumentRow(
          documentKindFromRow(reviewedDocument),
          reviewedDocument,
        ),
        verificationStatus: verification?.status ?? "draft",
      });
    }

    if (action.action !== "admin.sign") {
      throw new DomainError("VALIDATION_ERROR", 422, "Ação inválida.");
    }

    const document = await requireDocument(client, {
      documentId: action.documentId,
      therapistProfileId: action.therapistProfileId,
    });

    return success({
      signedPath: await createSignedDocumentPath({
        client,
        disposition: action.disposition,
        fileName: document.file_name,
        objectPath: document.storage_object_path,
      }),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        actor_role: "protected",
        correlation_id: correlationId,
        duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        error_code:
          error instanceof DomainError
            ? error.code
            : "therapist_private_documents_failed",
        operation: "therapist_private_documents",
      }),
    );

    return failure(error, correlationId);
  }
});

async function buildTherapistDocumentCenter(
  client: SupabaseRestClient,
  therapistProfileId: string,
  actorUserId: string,
) {
  const [documents, editorRows] = await Promise.all([
    listLatestDocuments(client, therapistProfileId),
    client.rpc<TherapistEditorReadModel[] | TherapistEditorReadModel>(
      "get_private_therapist_profile_editor_v1",
      {
        p_actor_user_id: actorUserId,
      },
    ),
  ]);

  const editor = Array.isArray(editorRows) ? editorRows[0] : editorRows;
  const currentFields =
    asRecord(editor?.draft?.fields) ??
    asRecord(editor?.published?.fields) ??
    {};

  const profileReady =
    hasText(currentFields.publicName) &&
    hasText(currentFields.shortIntro) &&
    hasText(currentFields.essenceBody);
  const servicesReady = toCount(editor?.derived?.activeServiceCount) > 0;
  const availabilityReady = toCount(editor?.derived?.availabilityRuleCount) > 0;
  const publicStatus = text(editor?.derived?.publicStatus) || "draft";
  const verificationStatus =
    text(editor?.derived?.verificationStatus) || "draft";
  const identityReady = hasUploadedDocument(documents.identity_document);
  const addressReady = hasUploadedDocument(documents.address_proof);
  const allInputsReady =
    profileReady &&
    servicesReady &&
    availabilityReady &&
    identityReady &&
    addressReady;

  const steps = [
    onboardingStep(
      "profile",
      "Perfil profissional",
      profileReady,
      "Informações básicas e apresentação.",
    ),
    onboardingStep(
      "services",
      "Serviços e terapias",
      servicesReady,
      "Especialidades e serviços publicados.",
    ),
    onboardingStep(
      "availability",
      "Disponibilidade",
      availabilityReady,
      "Horários e regras de atendimento.",
    ),
    onboardingStep(
      "identity_document",
      "Documento de identidade",
      identityReady,
      "RG, CNH ou passaporte com foto.",
    ),
    onboardingStep(
      "address_proof",
      "Comprovante de endereço",
      addressReady,
      "Documento emitido nos últimos 90 dias.",
    ),
    reviewStep({
      allInputsReady,
      publicStatus,
      verificationStatus,
    }),
  ];

  const firstActive = steps.findIndex((step) => step.state === "pending");
  const normalizedSteps = steps.map((step, index) => {
    if (step.state !== "pending") return step;

    if (step.key === "review") {
      return step;
    }

    return {
      ...step,
      state:
        firstActive === index ? ("current" as const) : ("pending" as const),
    };
  });

  const completedCount = normalizedSteps.filter(
    (step) => step.state === "complete",
  ).length;
  const percent = Math.round((completedCount / normalizedSteps.length) * 100);

  return {
    documents: [documents.identity_document, documents.address_proof],
    progress: {
      completedCount,
      percent,
      steps: normalizedSteps,
      totalCount: normalizedSteps.length,
    },
    summary: buildTherapistSummary({
      allInputsReady,
      missingCount: [identityReady, addressReady].filter((item) => !item)
        .length,
      publicStatus,
      verificationStatus,
    }),
    therapistProfileId,
    verificationStatus,
  };
}

async function buildAdminDocumentReview(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const [documents, profile, verification, eligibility] = await Promise.all([
    listLatestDocuments(client, therapistProfileId),
    readTherapistProfile(client, therapistProfileId),
    readLatestVerification(client, therapistProfileId),
    readPublicationEligibility(client, therapistProfileId),
  ]);

  const steps = buildAdminLifecycleSteps({
    eligibility,
    profile,
    verification,
  });
  const visibleDocuments = [
    documents.identity_document,
    documents.address_proof,
  ];

  return {
    documents: visibleDocuments,
    summary: {
      description: visibleDocuments.some((document) => document.id)
        ? "Confira os arquivos recebidos e use esta leitura como apoio à decisão administrativa."
        : "Nenhum documento obrigatório foi anexado até o momento.",
      hasDocuments: visibleDocuments.some((document) => document.id),
      title: "Documentos enviados",
    },
    therapistProfileId,
    timeline: {
      steps,
    },
    verificationStatus: verification?.status ?? "draft",
  };
}

async function storeTherapistDocument({
  client,
  file,
  kind,
  serviceRoleKey,
  supabaseUrl,
  therapistProfileId,
  userId,
}: {
  client: SupabaseRestClient;
  file: File;
  kind: TherapistPrivateDocumentKind;
  serviceRoleKey: string;
  supabaseUrl: string;
  therapistProfileId: string;
  userId: string;
}) {
  await validatePrivateDocumentUpload(file);

  const objectPath = `${therapistProfileId}/${kind}/${crypto.randomUUID()}${fileExtension(file.type)}`;
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,
    {
      body: file,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Cache-Control": "31536000",
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      method: "POST",
    },
  );

  if (!uploadResponse.ok) {
    console.error(
      JSON.stringify({
        operation: "therapist_private_document_storage_upload",
        storage_http_status: uploadResponse.status,
      }),
    );
    throw new DomainError(
      "UNAVAILABLE",
      502,
      "Não foi possível enviar o arquivo agora.",
    );
  }

  let inserted: PrivateDocumentRow[];
  try {
    inserted = await client.post<PrivateDocumentRow[]>(
      "/rest/v1/therapist_private_documents?select=id,document_kind,file_name,mime_type,file_size_bytes,status,storage_object_path,created_at,updated_at,validation_state,review_note,reviewed_at,reviewed_by",
      {
        document_kind: kind,
        file_name: sanitizeFileName(file.name),
        file_size_bytes: file.size,
        mime_type: file.type,
        status: "uploaded",
        storage_object_path: objectPath,
        therapist_profile_id: therapistProfileId,
        uploaded_by: userId,
        validation_state: "pending",
      },
      "return=representation",
    );
  } catch (error) {
    await deleteStoredObject({ objectPath, serviceRoleKey, supabaseUrl });
    throw error;
  }

  if (!inserted[0]) {
    await deleteStoredObject({ objectPath, serviceRoleKey, supabaseUrl });
    throw new DomainError(
      "UNAVAILABLE",
      502,
      "Não foi possível registrar o documento agora.",
    );
  }

  await client.patch(
    `/rest/v1/therapist_private_documents?therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&document_kind=eq.${encodeURIComponent(kind)}&status=neq.archived&id=neq.${encodeURIComponent(
      inserted[0].id,
    )}`,
    {
      status: "archived",
      updated_at: new Date().toISOString(),
    },
    "return=minimal",
  );

  return inserted[0];
}

async function deleteStoredObject({
  objectPath,
  serviceRoleKey,
  supabaseUrl,
}: {
  objectPath: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}) {
  try {
    await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      method: "DELETE",
    });
  } catch {
    // The upload is already unusable without its database record. Cleanup is
    // best effort and must not replace the original registration failure.
  }
}

async function listLatestDocuments(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const latest = await listLatestDocumentRows(client, therapistProfileId);

  return {
    address_proof: mapDocumentRow("address_proof", latest.get("address_proof")),
    identity_document: mapDocumentRow(
      "identity_document",
      latest.get("identity_document"),
    ),
  };
}

async function listLatestLegacyDocuments(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const latest = await listLatestDocumentRows(client, therapistProfileId);

  return [latest.get("identity_document"), latest.get("address_proof")]
    .filter(Boolean)
    .map((row) => toLegacyDocumentSummary(row!));
}

async function listLatestDocumentRows(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const rows = await client.get<PrivateDocumentRow[]>(
    `/rest/v1/therapist_private_documents?therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&status=neq.archived&select=id,document_kind,file_name,mime_type,file_size_bytes,status,storage_object_path,created_at,updated_at,validation_state,review_note,reviewed_at,reviewed_by&order=updated_at.desc`,
  );

  const latest = new Map<string, PrivateDocumentRow>();
  for (const row of rows) {
    if (
      typeof row.document_kind === "string" &&
      !latest.has(row.document_kind)
    ) {
      latest.set(row.document_kind, row);
    }
  }

  return latest;
}

function mapDocumentRow(
  kind: TherapistPrivateDocumentKind,
  row: PrivateDocumentRow | undefined,
) {
  const definition = requiredDocumentDefinition(kind);

  return {
    description: definition.description,
    fileName: row?.file_name ?? null,
    helper: definition.helper,
    id: row?.id ?? null,
    kind,
    mimeType: row?.mime_type ?? null,
    sizeBytes: row?.file_size_bytes ?? null,
    status: mapDocumentStatus(row),
    title: definition.title,
    uploadedAt: row?.updated_at ?? row?.created_at ?? null,
    validationState: (row?.validation_state as string | null) ?? null,
    reviewNote: row?.review_note ?? null,
    reviewedAt: row?.reviewed_at ?? null,
  };
}

function mapDocumentStatus(row: PrivateDocumentRow | undefined) {
  if (!row) return "missing";
  if (row.status === "accepted" || row.validation_state === "passed") {
    return "accepted";
  }
  if (row.status === "rejected" || row.validation_state === "failed") {
    return "rejected";
  }
  return "uploaded";
}

async function readTherapistProfile(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const rows = await client.get<TherapistProfileRecord[]>(
    `/rest/v1/therapist_profiles?select=id,user_id,status,public_status,is_public,is_accepting_bookings,last_published_at,created_at,updated_at&id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&limit=1`,
  );

  if (!rows[0]) {
    throw new DomainError(
      "PROFILE_NOT_FOUND",
      404,
      "Perfil profissional não encontrado.",
    );
  }

  return rows[0];
}

async function readLatestVerification(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const rows = await client.get<VerificationRecord[]>(
    `/rest/v1/therapist_verifications?select=id,status,submitted_at,reviewed_at,created_at,updated_at&therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&order=submitted_at.desc.nullslast,created_at.desc,id.desc&limit=1`,
  );

  return rows[0] ?? null;
}

async function readPublicationEligibility(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  return await client.rpc<PublicationEligibility>(
    "get_therapist_publication_eligibility_v1",
    {
      p_therapist_profile_id: therapistProfileId,
    },
  );
}

async function requireDocument(
  client: SupabaseRestClient,
  identifiers: { documentId: string; therapistProfileId: string },
) {
  const rows = await client.get<PrivateDocumentRow[]>(
    `/rest/v1/therapist_private_documents?id=eq.${encodeURIComponent(
      identifiers.documentId,
    )}&therapist_profile_id=eq.${encodeURIComponent(
      identifiers.therapistProfileId,
    )}&status=neq.archived&select=id,document_kind,file_name,mime_type,file_size_bytes,status,storage_object_path,created_at,updated_at,validation_state,review_note,reviewed_at,reviewed_by&limit=1`,
  );

  if (!rows[0]) {
    throw new DomainError(
      "DOCUMENT_NOT_FOUND",
      404,
      "Documento não encontrado.",
    );
  }

  return rows[0];
}

async function reviewPrivateDocument({
  action,
  actorUserId,
  client,
  document,
}: {
  action: Extract<
    Awaited<ReturnType<typeof parseTherapistPrivateDocumentsAction>>,
    { action: "admin.review" }
  >;
  actorUserId: string;
  client: SupabaseRestClient;
  document: PrivateDocumentRow;
}) {
  const nextStatus =
    action.decision === "accepted" ? "accepted" : "rejected";
  const nextValidationState =
    action.decision === "accepted" ? "passed" : "failed";
  const reviewNote =
    action.decision === "resubmission_requested" ? action.reason : null;

  const rows = await client.patch<PrivateDocumentRow[]>(
    `/rest/v1/therapist_private_documents?id=eq.${encodeURIComponent(
      document.id,
    )}&therapist_profile_id=eq.${encodeURIComponent(action.therapistProfileId)}&status=neq.archived&select=id,document_kind,file_name,mime_type,file_size_bytes,status,storage_object_path,created_at,updated_at,validation_state,review_note,reviewed_at,reviewed_by`,
    {
      review_note: reviewNote,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorUserId,
      status: nextStatus,
      validation_state: nextValidationState,
    },
    "return=representation",
  );

  if (!rows[0]) {
    throw new DomainError(
      "DOCUMENT_NOT_FOUND",
      404,
      "Documento não encontrado.",
    );
  }

  await client.post(
    "/rest/v1/therapist_private_document_review_events",
    {
      action: action.decision,
      actor_user_id: actorUserId,
      document_id: document.id,
      next_status: nextStatus,
      previous_status: document.status,
      reason: reviewNote,
      therapist_profile_id: action.therapistProfileId,
    },
    "return=minimal",
  );

  return rows[0];
}

async function createSignedDocumentPath({
  client,
  disposition,
  fileName,
  objectPath,
}: {
  client: SupabaseRestClient;
  disposition: "attachment" | "inline";
  fileName: string;
  objectPath: string;
}) {
  const payload = await client.post<{ signedURL?: string; signedUrl?: string }>(
    `/storage/v1/object/sign/${bucket}/${objectPath}`,
    {
      expiresIn: 60,
    },
  );
  const rawSignedPath = payload?.signedURL ?? payload?.signedUrl;

  if (!rawSignedPath) {
    throw new DomainError(
      "UNAVAILABLE",
      502,
      "Não foi possível abrir o documento agora.",
    );
  }

  const signedPath = normalizeSignedStoragePath(rawSignedPath);

  if (disposition === "attachment") {
    const url = new URL(signedPath, "http://storage.local");
    url.searchParams.set("download", fileName);
    return `${url.pathname}${url.search}`;
  }

  return signedPath;
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

function onboardingStep(
  key: string,
  label: string,
  complete: boolean,
  description: string,
) {
  return {
    description,
    detail: complete ? "Concluído" : "Pendente",
    key,
    label,
    state: complete ? ("complete" as const) : ("pending" as const),
  };
}

function reviewStep({
  allInputsReady,
  publicStatus,
  verificationStatus,
}: {
  allInputsReady: boolean;
  publicStatus: string;
  verificationStatus: string;
}) {
  if (verificationStatus === "approved") {
    return {
      description: "Seu cadastro já passou pela análise administrativa.",
      detail: "Aprovado",
      key: "review",
      label: "Revisão e análise",
      state: "complete" as const,
    };
  }

  if (
    verificationStatus === "submitted" ||
    verificationStatus === "in_review"
  ) {
    return {
      description:
        "Nossa equipe está avaliando o cadastro e os documentos enviados.",
      detail:
        verificationStatus === "in_review"
          ? "Em análise"
          : "Enviado para análise",
      key: "review",
      label: "Revisão e análise",
      state: "current" as const,
    };
  }

  if (publicStatus !== "published") {
    return {
      description:
        "Publique o perfil para colocar o cadastro na fila administrativa.",
      detail: "Bloqueado até a publicação",
      key: "review",
      label: "Revisão e análise",
      state: "blocked" as const,
    };
  }

  if (!allInputsReady) {
    return {
      description:
        "Envie os documentos obrigatórios para completar o cadastro administrativo.",
      detail: "Aguardando pendências",
      key: "review",
      label: "Revisão e análise",
      state: "blocked" as const,
    };
  }

  return {
    description:
      "Seu perfil publicado e os documentos enviados já deixam o cadastro pronto para acompanhamento administrativo.",
    detail: "Pronto para acompanhamento",
    key: "review",
    label: "Revisão e análise",
    state: "current" as const,
  };
}

function buildTherapistSummary({
  allInputsReady,
  missingCount,
  publicStatus,
  verificationStatus,
}: {
  allInputsReady: boolean;
  missingCount: number;
  publicStatus: string;
  verificationStatus: string;
}) {
  if (verificationStatus === "approved") {
    return {
      description:
        "Seu perfil e os documentos obrigatórios já passaram pela análise administrativa.",
      missingCount,
      readyForReview: true,
      title: "Cadastro aprovado",
      tone: "success" as const,
    };
  }

  if (
    verificationStatus === "submitted" ||
    verificationStatus === "in_review"
  ) {
    return {
      description:
        "Recebemos suas informações e documentos. Nossa equipe está avaliando seu cadastro profissional.",
      missingCount,
      readyForReview: true,
      title:
        verificationStatus === "in_review"
          ? "Cadastro em análise"
          : "Cadastro enviado com sucesso",
      tone: "info" as const,
    };
  }

  if (publicStatus !== "published") {
    return {
      description:
        "Conclua o perfil, publique as alterações e anexe os documentos obrigatórios para apoiar a análise administrativa.",
      missingCount,
      readyForReview: false,
      title: "Cadastro ainda não está pronto para análise",
      tone: "attention" as const,
    };
  }

  if (!allInputsReady || missingCount > 0) {
    return {
      description:
        "Seu perfil já está publicado, mas ainda faltam documentos obrigatórios para completar a análise administrativa.",
      missingCount,
      readyForReview: false,
      title: "Ainda faltam documentos obrigatórios",
      tone: "attention" as const,
    };
  }

  return {
    description:
      "Seus documentos foram recebidos. A próxima atualização acontecerá no acompanhamento administrativo interno do TES.",
    missingCount,
    readyForReview: true,
    title: "Documentos recebidos",
    tone: "info" as const,
  };
}

function buildAdminLifecycleSteps({
  eligibility,
  profile,
  verification,
}: {
  eligibility: PublicationEligibility;
  profile: TherapistProfileRecord;
  verification: VerificationRecord | null;
}) {
  const canReceiveBookings = Boolean(eligibility?.eligible);
  const reviewState =
    verification?.status === "submitted" || verification?.status === "in_review"
      ? "current"
      : verification?.status === "approved"
        ? "complete"
        : "pending";
  const approvedState =
    verification?.status === "approved"
      ? profile.public_status === "published" || canReceiveBookings
        ? "complete"
        : "current"
      : "pending";
  const publishedState =
    profile.public_status === "published"
      ? canReceiveBookings
        ? "complete"
        : "current"
      : "pending";
  const bookableState = canReceiveBookings ? "current" : "pending";

  return [
    {
      detail: formatTimelineDate(profile.created_at),
      key: "created" as const,
      label: "Enviado",
      state: "complete" as const,
    },
    {
      detail: verification
        ? formatTimelineDate(
            verification.submitted_at ?? verification.updated_at,
          )
        : "Ainda não há envio para análise",
      key: "review" as const,
      label: "Em análise",
      state: reviewState,
    },
    {
      detail: verification?.reviewed_at
        ? formatTimelineDate(verification.reviewed_at)
        : "Aguardando decisão",
      key: "approved" as const,
      label: "Aprovado",
      state: approvedState,
    },
    {
      detail:
        profile.public_status === "published"
          ? profile.last_published_at
            ? formatTimelineDate(profile.last_published_at)
            : "Ativo"
          : "Pendente",
      key: "published" as const,
      label: "Publicado",
      state: publishedState,
    },
    {
      detail: canReceiveBookings ? "Ativo" : "Pendente",
      key: "bookable" as const,
      label: "Disponível para agendamento",
      state: bookableState,
    },
  ];
}

function formatTimelineDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
}

function hasUploadedDocument(document: { id: string | null; status: string }) {
  return (
    document.id !== null &&
    document.status !== "missing" &&
    document.status !== "rejected"
  );
}

function documentKindFromRow(
  row: PrivateDocumentRow,
): TherapistPrivateDocumentKind {
  return row.document_kind === "address_proof"
    ? "address_proof"
    : "identity_document";
}

function toCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .slice(0, 120) || "documento"
  );
}

function toLegacyDocumentSummary(
  row: PrivateDocumentRow,
): LegacyPrivateDocumentSummary {
  return {
    createdAt: row.created_at,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    id: row.id,
    kind:
      row.document_kind === "address_proof"
        ? "address_proof"
        : "identity_document",
    mimeType: row.mime_type,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    status: mapLegacyDocumentStatus(row),
    updatedAt: row.updated_at,
    validationState: mapLegacyValidationState(row.validation_state),
  };
}

function mapLegacyDocumentStatus(
  row: PrivateDocumentRow,
): LegacyPrivateDocumentSummary["status"] {
  if (row.status === "accepted" || row.validation_state === "passed") {
    return "accepted";
  }
  if (row.status === "rejected" || row.validation_state === "failed") {
    return "rejected";
  }
  return "uploaded";
}

function mapLegacyValidationState(
  value: string,
): LegacyPrivateDocumentSummary["validationState"] {
  if (
    value === "failed" ||
    value === "not_scanned" ||
    value === "passed" ||
    value === "pending"
  ) {
    return value;
  }

  return "pending";
}
