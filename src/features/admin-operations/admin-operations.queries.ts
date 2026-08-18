import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import { routes } from "@/lib/routes";
import {
  ADMIN_LIST_DEFAULT_PAGE_SIZE,
  parseAdminListQuery,
  toAdminListRpcQuery,
  type AdminListOption,
  type AdminListPageInfo,
  type AdminListQuery,
} from "@/features/admin-shared/admin-list-query";
import { getAdminProfessionalDocumentReview } from "@/features/therapist-private-documents/private-documents.queries";

import {
  mapAdminOperationDetail,
  mapAdminOperationRows,
} from "./admin-operations.mappers";
import type {
  AdminOperationDetailPageResult,
  AdminOperationMetric,
  AdminOperationModuleKey,
  AdminOperationPageData,
  AdminOperationPageResult,
  AdminProfessionalPublishedProfile,
  AdminProfessionalVerificationSummary,
} from "./admin-operations.types";

type CountSpec = {
  description: string;
  key: string;
  label: string;
  source: string;
  tone: AdminOperationMetric["tone"];
};

type ModuleSpec = {
  description: string;
  emptyMessage: string;
  metrics: CountSpec[];
  safetyNotes: string[];
  sourceLabel: string;
  statusOptions: AdminListOption[];
  title: string;
};

type AdminOperationReadModel = {
  filtersApplied?: unknown;
  generatedAt?: unknown;
  metrics?: unknown;
  module?: unknown;
  page?: unknown;
  rows?: unknown;
};

type AdminOperationReadResult =
  | {
      model: AdminOperationReadModel;
      status: "available";
    }
  | {
      errorCode: string;
      status: "forbidden" | "unavailable";
    };

type AdminOperationDetailReadModel = {
  auditEvents?: unknown;
  generatedAt?: unknown;
  id?: unknown;
  module?: unknown;
  record?: unknown;
};

type AdminOperationDetailReadResult =
  | {
      model: AdminOperationDetailReadModel;
      status: "available";
    }
  | {
      errorCode: string;
      status: "forbidden" | "not_found" | "unavailable";
    };

const MODULES: Record<AdminOperationModuleKey, ModuleSpec> = {
  patients: {
    description:
      "Acompanhe a base de clientes com dados operacionais mínimos e sem conteúdo clínico.",
    emptyMessage: "Nenhum cliente disponível para esta consulta.",
    metrics: [
      metric(
        "total-patients",
        "Clientes",
        "Base cadastrada.",
        "patient_profiles",
        "info",
      ),
      metric(
        "recent-patients",
        "Novos no período",
        "Cadastros dos últimos 30 dias.",
        "patient_profiles",
        "success",
      ),
    ],
    safetyNotes: [
      "A lista evita dados sensíveis de jornada, mensagens, intake ou conteúdo clínico.",
      "Ações de bloqueio exigem motivo e registro da decisão.",
    ],
    sourceLabel: "Clientes",
    statusOptions: [
      option("", "Todos os status"),
      option("active", "Ativos"),
      option("deleted", "Excluídos"),
      option("anonymized", "Anonimizados"),
    ],
    title: "Clientes",
  },
  professionals: {
    description:
      "Gerencie a operação dos terapeutas sem alterar plano, verificação ou publicação diretamente.",
    emptyMessage: "Nenhum profissional disponível para esta consulta.",
    metrics: [
      metric(
        "total-professionals",
        "Profissionais",
        "Perfis de terapeuta.",
        "therapist_profiles",
        "info",
      ),
      metric(
        "approved-professionals",
        "Aprovados",
        "Profissionais com cadastro aprovado.",
        "therapist_profiles",
        "success",
      ),
      metric(
        "public-professionals",
        "Publicados",
        "Perfis públicos ativos.",
        "therapist_profiles",
        "success",
      ),
      metric(
        "booking-professionals",
        "Recebendo reservas",
        "Profissionais aceitando reservas.",
        "therapist_profiles",
        "info",
      ),
    ],
    safetyNotes: [
      "Suspensão e reativação exigem motivo e registro da decisão.",
      "Publicação e plano de assinatura seguem fluxos próprios de aprovação.",
    ],
    sourceLabel: "Profissionais",
    statusOptions: [
      option("", "Todos os status"),
      option("draft", "Perfil em construção"),
      option("submitted", "Aguardando análise"),
      option("in_review", "Em análise"),
      option("changes_requested", "Ajustes solicitados"),
      option("approved", "Aprovados"),
      option("rejected", "Reprovados"),
      option("suspended", "Suspensos"),
    ],
    title: "Profissionais",
  },
  reviews: {
    description:
      "Monitore avaliações para moderação sem expor comentários em listagem operacional.",
    emptyMessage: "Nenhuma avaliação disponível para esta consulta.",
    metrics: [
      metric(
        "total-reviews",
        "Avaliações",
        "Registros recebidos.",
        "reviews",
        "info",
      ),
      metric(
        "published-reviews",
        "Publicadas",
        "Avaliações públicas.",
        "reviews",
        "success",
      ),
      metric(
        "pending-reviews",
        "Pendentes",
        "Avaliações aguardando revisão.",
        "reviews",
        "warning",
      ),
    ],
    safetyNotes: [
      "Comentários não aparecem na lista para reduzir exposição desnecessária.",
      "Ocultar ou restaurar uma avaliação registra a decisão e preserva o histórico.",
    ],
    sourceLabel: "Avaliações",
    statusOptions: [
      option("", "Todos os status"),
      option("pending", "Pendentes"),
      option("reported", "Reportadas"),
      option("published", "Publicadas"),
      option("hidden", "Ocultas"),
    ],
    title: "Avaliações",
  },
  sessions: {
    description:
      "Acompanhe reservas, pagamento e encontros online sem expor links privados.",
    emptyMessage: "Nenhuma sessão disponível para esta consulta.",
    metrics: [
      metric(
        "total-sessions",
        "Sessões",
        "Reservas registradas.",
        "bookings",
        "info",
      ),
      metric(
        "future-sessions",
        "Futuras",
        "Sessões com início futuro.",
        "bookings",
        "info",
      ),
      metric(
        "attention-sessions",
        "Atenção",
        "Sessões com status operacional sensível.",
        "bookings",
        "warning",
      ),
    ],
    safetyNotes: [
      "Links de reunião e dados clínicos não são carregados nesta visão.",
      "Cancelamento, reembolso e reagendamento exigem confirmação autorizada.",
    ],
    sourceLabel: "Sessões",
    statusOptions: [
      option("", "Todos os status"),
      option("pending_payment", "Pagamento pendente"),
      option("confirmed", "Confirmadas"),
      option("completed", "Concluídas"),
      option("cancelled_by_patient", "Canceladas pelo cliente"),
      option("cancelled_by_therapist", "Canceladas pelo terapeuta"),
      option("refunded", "Reembolsadas"),
    ],
    title: "Sessões",
  },
  support: {
    description:
      "Acompanhe chamados e urgência operacional sem abrir conteúdo sensível por padrão.",
    emptyMessage: "Nenhum chamado disponível para esta consulta.",
    metrics: [
      metric(
        "total-support",
        "Chamados",
        "Chamados registrados.",
        "support_tickets",
        "info",
      ),
      metric(
        "open-support",
        "Abertos",
        "Chamados ainda abertos.",
        "support_tickets",
        "warning",
      ),
      metric(
        "urgent-support",
        "Urgentes",
        "Chamados marcados como urgentes.",
        "support_tickets",
        "danger",
      ),
    ],
    safetyNotes: [
      "A descrição completa do chamado não aparece nesta lista.",
      "Resolver ou reabrir registra a decisão; resposta e escalação seguem o fluxo de atendimento.",
    ],
    sourceLabel: "Suporte",
    statusOptions: [
      option("", "Todos os status"),
      option("open", "Abertos"),
      option("in_progress", "Em andamento"),
      option("resolved", "Resolvidos"),
      option("closed", "Fechados"),
    ],
    title: "Suporte",
  },
  verifications: {
    description:
      "Acompanhe verificações de terapeutas sem expor documentos privados na lista.",
    emptyMessage: "Nenhuma verificação disponível para esta consulta.",
    metrics: [
      metric(
        "total-verifications",
        "Cadastros na fila",
        "Perfis enviados para revisão.",
        "therapist_verifications",
        "info",
      ),
      metric(
        "pending-verifications",
        "Pendentes",
        "Aguardando análise, em análise ou com ajustes solicitados.",
        "therapist_verifications",
        "warning",
      ),
    ],
    safetyNotes: [
      "Informações de documentos privados não são carregadas nesta lista.",
      "Aprovar, reprovar ou solicitar ajuste exige motivo e registro da decisão.",
    ],
    sourceLabel: "Verificações",
    statusOptions: [
      option("", "Todos os status"),
      option("submitted", "Aguardando análise"),
      option("in_review", "Em análise"),
      option("changes_requested", "Ajustes solicitados"),
      option("approved", "Aprovadas"),
      option("rejected", "Reprovadas"),
    ],
    title: "Verificações",
  },
};

const SORT_OPTIONS: AdminListOption[] = [
  option("recent", "Mais recentes"),
  option("oldest", "Mais antigos"),
  option("status", "Status"),
  option("name", "Nome"),
];

export const getAdminOperationPage = cache(async function getAdminOperationPage({
  accessToken,
  module,
  searchParams,
}: {
  accessToken: string;
  module: AdminOperationModuleKey;
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<AdminOperationPageResult> {
  const config = getSupabasePublicConfig();
  const spec = MODULES[module];
  const query = parseAdminListQuery(searchParams);

  if (!config) {
    return {
      message: "Não foi possível carregar este módulo agora.",
      status: "error",
    };
  }

  const readResult = await fetchAdminOperationReadModel({
    accessToken,
    config,
    module,
    query,
  });

  if (readResult.status !== "available") {
    const rowsUnavailableMessage =
      readResult.status === "forbidden"
        ? "A sessão atual não tem permissão para consultar este módulo."
        : "A leitura administrativa falhou. Isso não é tratado como lista vazia.";

    return {
        data: {
          description: spec.description,
          emptyMessage: spec.emptyMessage,
          filterOptions: {
            sort: SORT_OPTIONS,
            status: spec.statusOptions,
          },
          generatedAt: new Date().toISOString(),
          listHref: getOperationListHref(module),
          metrics: spec.metrics.map((metricSpec) =>
            unavailableMetric(metricSpec, readResult.status),
          ),
          page: emptyPage(query),
          query,
          rows: [],
          rowsStatus: readResult.status,
        rowsUnavailableMessage,
        safetyNotes: spec.safetyNotes,
        sourceLabel: spec.sourceLabel,
        title: spec.title,
      },
      status: "success",
    };
  }

  const metricsPayload = isRecord(readResult.model.metrics)
    ? readResult.model.metrics
    : {};
  const rowsPayload = Array.isArray(readResult.model.rows)
    ? readResult.model.rows
    : [];

  return {
    data: {
      description: spec.description,
      emptyMessage: spec.emptyMessage,
      generatedAt:
        asString(readResult.model.generatedAt) ?? new Date().toISOString(),
      listHref: getOperationListHref(module),
      metrics: spec.metrics.map((metricSpec) =>
        availableMetric(metricSpec, metricsPayload),
      ),
      filterOptions: {
        sort: SORT_OPTIONS,
        status: spec.statusOptions,
      },
      page: mapPageInfo(readResult.model.page, query),
      query,
      rows: mapAdminOperationRows({ module, rows: rowsPayload }),
      rowsStatus: "available",
      safetyNotes: spec.safetyNotes,
      sourceLabel: spec.sourceLabel,
      title: spec.title,
    },
    status: "success",
  };
});

export const getAdminOperationDetailPage = cache(
  async function getAdminOperationDetailPage({
    accessToken,
    id,
    module,
  }: {
    accessToken: string;
    id: string;
    module: AdminOperationModuleKey;
  }): Promise<AdminOperationDetailPageResult> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Não foi possível carregar este detalhe agora.",
        status: "error",
      };
    }

    const readResult = await fetchAdminOperationDetailReadModel({
      accessToken,
      config,
      id,
      module,
    });

    if (readResult.status === "not_found") {
      return { status: "not_found" };
    }

    if (readResult.status !== "available") {
      return {
        message:
          readResult.status === "forbidden"
            ? "A sessão atual não tem permissão para consultar este detalhe."
            : "A leitura administrativa do detalhe falhou.",
        status: "error",
      };
    }

    if (!isRecord(readResult.model.record)) {
      return { status: "not_found" };
    }

    const detail = mapAdminOperationDetail({
      auditEvents: Array.isArray(readResult.model.auditEvents)
        ? readResult.model.auditEvents
        : [],
      generatedAt:
        asString(readResult.model.generatedAt) ?? new Date().toISOString(),
      module,
      record: readResult.model.record,
    });

    if (module === "professionals") {
      const profileId = detail.id;
      const slug = asString(readResult.model.record.slug);
      const [publicProfile, verificationSummary, privateDocuments] =
        await Promise.all([
        fetchAdminProfessionalPublishedProfile({
          accessToken,
          config,
          profileId,
          slug,
        }),
        fetchAdminProfessionalVerificationSummary({
          accessToken,
          config,
          profileId,
        }),
        getAdminProfessionalDocumentReview({
          accessToken,
          therapistProfileId: profileId,
        }),
      ]);

      detail.publicProfile = publicProfile;
      detail.privateDocuments =
        privateDocuments.status === "success" ? privateDocuments.data : null;
      detail.verificationSummary =
        verificationSummary ??
        deriveProfileDecisionVerificationSummary(detail.statusLabel);
    }

    if (module === "verifications" && detail.relatedProfessionalId) {
      const privateDocuments = await getAdminProfessionalDocumentReview({
        accessToken,
        therapistProfileId: detail.relatedProfessionalId,
      });

      detail.privateDocuments =
        privateDocuments.status === "success" ? privateDocuments.data : null;
    }

    return {
      data: detail,
      status: "success",
    };
  },
);

async function fetchAdminProfessionalPublishedProfile({
  accessToken,
  config,
  profileId,
  slug,
}: {
  accessToken: string;
  config: { apiKey: string; url: string },
  profileId: string;
  slug?: string;
}): Promise<AdminProfessionalPublishedProfile> {
  const unavailable = {
    content: null,
    services: null,
    status: "unavailable" as const,
  };

  try {
    const contentResponse = await fetch(
      `${config.url}/rest/v1/public_therapist_profile_content_v?therapist_profile_id=eq.${encodeURIComponent(profileId)}&select=short_intro,essence_body,invitation_body,experience_years,guide_items`,
      {
        cache: "no-store",
        headers: adminReadHeaders({ accessToken, config }),
      },
    );

    if (!contentResponse.ok) return unavailable;

    const contentPayload = await contentResponse.json().catch(() => null);
    const contentRow = Array.isArray(contentPayload)
      ? contentPayload.find(isRecord)
      : null;

    if (!contentRow) {
      return { content: null, services: [], status: "available" };
    }

    const services = slug
      ? await fetchAdminProfessionalPublishedServices({
          accessToken,
          config,
          slug,
        })
      : [];

    return {
      content: {
        essenceBody: asString(contentRow.essence_body) ?? null,
        experienceYears: asFiniteNumber(contentRow.experience_years),
        guideItems: mapGuideItems(contentRow.guide_items),
        invitationBody: asString(contentRow.invitation_body) ?? null,
        shortIntro: asString(contentRow.short_intro) ?? null,
      },
      services,
      status: "available",
    };
  } catch {
    return unavailable;
  }
}

async function fetchAdminProfessionalVerificationSummary({
  accessToken,
  config,
  profileId,
}: {
  accessToken: string;
  config: { apiKey: string; url: string };
  profileId: string;
}): Promise<AdminProfessionalVerificationSummary | null> {
  try {
    const response = await fetch(
      `${config.url}/rest/v1/therapist_verifications?therapist_profile_id=eq.${encodeURIComponent(profileId)}&select=status,submitted_at,reviewed_at&order=submitted_at.desc.nullslast,created_at.desc&limit=1`,
      {
        cache: "no-store",
        headers: adminReadHeaders({ accessToken, config }),
      },
    );

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    const row = Array.isArray(payload) ? payload.find(isRecord) : null;

    if (!row) return null;

    return {
      reviewedAt: asString(row.reviewed_at) ?? null,
      source: "verification",
      status: normalizeVerificationStatus(asString(row.status)),
      submittedAt: asString(row.submitted_at) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Perfis aprovados ou suspensos antes da fila de verificações não possuem,
 * necessariamente, um registro em therapist_verifications. A decisão do
 * perfil já é autoritativa, mas não deve criar ou alterar uma verificação
 * retroativamente. Este resumo serve apenas para a leitura da linha do tempo.
 */
export function deriveProfileDecisionVerificationSummary(
  profileStatus?: string | null,
): AdminProfessionalVerificationSummary | null {
  if (profileStatus !== "approved" && profileStatus !== "suspended") {
    return null;
  }

  return {
    reviewedAt: null,
    source: "profile_status",
    status: profileStatus,
    submittedAt: null,
  };
}

async function fetchAdminProfessionalPublishedServices({
  accessToken,
  config,
  slug,
}: {
  accessToken: string;
  config: { apiKey: string; url: string };
  slug: string;
}): Promise<AdminProfessionalPublishedProfile["services"]> {
  try {
    const response = await fetch(
      `${config.url}/rest/v1/public_therapist_profile_services_v?therapist_slug=eq.${encodeURIComponent(slug)}&select=service_title,therapy_name,description,duration_minutes,price_cents&order=sort_order.asc`,
      {
        cache: "no-store",
        headers: adminReadHeaders({ accessToken, config }),
      },
    );

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    if (!Array.isArray(payload)) return null;

    return payload.filter(isRecord).map((row) => ({
      description: asString(row.description) ?? null,
      durationMinutes: asFiniteNumber(row.duration_minutes),
      priceCents: asFiniteNumber(row.price_cents),
      serviceTitle: asString(row.service_title) ?? null,
      therapyName: asString(row.therapy_name) ?? null,
    }));
  } catch {
    return null;
  }
}

function adminReadHeaders({
  accessToken,
  config,
}: {
  accessToken: string;
  config: { apiKey: string };
}) {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeVerificationStatus(
  value?: string | null,
): AdminProfessionalVerificationSummary["status"] {
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

async function fetchAdminOperationReadModel({
  accessToken,
  config,
  module,
  query,
}: {
  accessToken: string;
  config: { apiKey: string; url: string };
  module: AdminOperationModuleKey;
  query: AdminListQuery;
}): Promise<AdminOperationReadResult> {
  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_get_operation_module_v2`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          p_module: module,
          p_query: toAdminListRpcQuery(query),
        }),
      },
    );

    if (response.status === 401 || response.status === 403) {
      logAdminOperationReadFailure({
        errorCode: "ADMIN_OPERATION_FORBIDDEN",
        module,
        status: response.status,
      });

      return { errorCode: "ADMIN_OPERATION_FORBIDDEN", status: "forbidden" };
    }

    if (!response.ok) {
      logAdminOperationReadFailure({
        errorCode: "ADMIN_OPERATION_QUERY_FAILED",
        module,
        status: response.status,
      });

      return {
        errorCode: "ADMIN_OPERATION_QUERY_FAILED",
        status: "unavailable",
      };
    }

    const model = await response.json().catch(() => null);

    if (!isRecord(model)) {
      logAdminOperationReadFailure({
        errorCode: "ADMIN_OPERATION_INVALID_JSON",
        module,
        status: response.status,
      });

      return {
        errorCode: "ADMIN_OPERATION_INVALID_JSON",
        status: "unavailable",
      };
    }

    return { model, status: "available" };
  } catch {
    logAdminOperationReadFailure({
      errorCode: "ADMIN_OPERATION_NETWORK_ERROR",
      module,
    });

    return { errorCode: "ADMIN_OPERATION_NETWORK_ERROR", status: "unavailable" };
  }
}

async function fetchAdminOperationDetailReadModel({
  accessToken,
  config,
  id,
  module,
}: {
  accessToken: string;
  config: { apiKey: string; url: string };
  id: string;
  module: AdminOperationModuleKey;
}): Promise<AdminOperationDetailReadResult> {
  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_get_operation_detail_v1`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          p_id: id,
          p_module: module,
        }),
      },
    );

    if (response.status === 401 || response.status === 403) {
      logAdminOperationReadFailure({
        errorCode: "ADMIN_OPERATION_DETAIL_FORBIDDEN",
        module,
        status: response.status,
      });

      return {
        errorCode: "ADMIN_OPERATION_DETAIL_FORBIDDEN",
        status: "forbidden",
      };
    }

    if (!response.ok) {
      logAdminOperationReadFailure({
        errorCode: "ADMIN_OPERATION_DETAIL_QUERY_FAILED",
        module,
        status: response.status,
      });

      return {
        errorCode: "ADMIN_OPERATION_DETAIL_QUERY_FAILED",
        status: "unavailable",
      };
    }

    const model = await response.json().catch(() => null);

    if (!isRecord(model)) {
      logAdminOperationReadFailure({
        errorCode: "ADMIN_OPERATION_DETAIL_INVALID_JSON",
        module,
        status: response.status,
      });

      return {
        errorCode: "ADMIN_OPERATION_DETAIL_INVALID_JSON",
        status: "unavailable",
      };
    }

    if (model.record === null) {
      return { errorCode: "ADMIN_OPERATION_DETAIL_NOT_FOUND", status: "not_found" };
    }

    return { model, status: "available" };
  } catch {
    logAdminOperationReadFailure({
      errorCode: "ADMIN_OPERATION_DETAIL_NETWORK_ERROR",
      module,
    });

    return {
      errorCode: "ADMIN_OPERATION_DETAIL_NETWORK_ERROR",
      status: "unavailable",
    };
  }
}

function availableMetric(
  spec: CountSpec,
  metricsPayload: Record<string, unknown>,
): AdminOperationMetric {
  const value = metricsPayload[spec.key];

  return {
    description: spec.description,
    key: spec.key,
    label: spec.label,
    source: spec.source,
    status:
      typeof value === "number" && Number.isFinite(value)
        ? "available"
        : "unavailable",
    tone: spec.tone,
    value: typeof value === "number" && Number.isFinite(value) ? value : null,
  };
}

function unavailableMetric(
  spec: CountSpec,
  status: "forbidden" | "unavailable",
): AdminOperationMetric {
  return {
    description: spec.description,
    key: spec.key,
    label: spec.label,
    source: spec.source,
    status,
    tone: spec.tone,
    value: null,
  };
}

function metric(
  key: string,
  label: string,
  description: string,
  source: string,
  tone: AdminOperationMetric["tone"],
): CountSpec {
  return {
    description,
    key,
    label,
    source,
    tone,
  };
}

function option(value: string, label: string): AdminListOption {
  return { label, value };
}

function getOperationListHref(module: AdminOperationModuleKey) {
  if (module === "professionals") return routes.admin.professionals;
  if (module === "verifications") return routes.admin.verifications;
  if (module === "patients") return routes.admin.patients;
  if (module === "sessions") return routes.admin.sessions;
  if (module === "support") return routes.admin.support;

  return routes.admin.reviews;
}

function emptyPage(query: AdminListQuery): AdminListPageInfo {
  return {
    hasNext: false,
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
  };
}

function mapPageInfo(value: unknown, query: AdminListQuery): AdminListPageInfo {
  if (!isRecord(value)) return emptyPage(query);

  return {
    hasNext: Boolean(value.hasNext),
    page: asPositiveNumber(value.page, query.page),
    pageSize: asPositiveNumber(value.pageSize, query.pageSize),
    total: asNonNegativeNumber(value.total, 0),
  };
}

function asPositiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function asNonNegativeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapGuideItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).flatMap((item) => {
    const label = asString(item.label);
    return label ? [{ label }] : [];
  });
}

function logAdminOperationReadFailure({
  errorCode,
  module,
  status,
}: {
  errorCode: string;
  module: AdminOperationModuleKey;
  status?: number;
}) {
  console.error(
    JSON.stringify({
      errorCode,
      operation: "admin.operation.read",
      module,
      status,
    }),
  );
}
