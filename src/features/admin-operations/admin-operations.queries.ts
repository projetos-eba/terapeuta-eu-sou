import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

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
  title: string;
};

type AdminOperationReadModel = {
  generatedAt?: unknown;
  metrics?: unknown;
  module?: unknown;
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
    emptyMessage: "Nenhum cliente acessível para a sessão administrativa atual.",
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
      "Ações de bloqueio exigem contrato dedicado, motivo e auditoria.",
    ],
    sourceLabel: "patient_profiles",
    title: "Clientes",
  },
  professionals: {
    description:
      "Gerencie a superfície operacional dos terapeutas sem alterar plano, verificação ou publicação diretamente.",
    emptyMessage:
      "Nenhum profissional acessível para a sessão administrativa atual.",
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
      "Suspensão e reativação usam comando com motivo, idempotência por requestId e auditoria.",
      "Publicação e plano de assinatura não devem ser alterados diretamente pelo admin.",
    ],
    sourceLabel: "therapist_profiles",
    title: "Profissionais",
  },
  reviews: {
    description:
      "Monitore avaliações para moderação sem expor comentários em listagem operacional.",
    emptyMessage: "Nenhuma avaliação acessível para a sessão administrativa atual.",
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
      "Ocultar/restaurar avaliação usa comando auditado e preserva o registro original.",
    ],
    sourceLabel: "reviews",
    title: "Avaliações",
  },
  sessions: {
    description:
      "Acompanhe reservas, pagamento e janela online sem expor URL secreta de reunião.",
    emptyMessage: "Nenhuma sessão acessível para a sessão administrativa atual.",
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
      "URLs de reunião e dados clínicos não são carregados nesta visão.",
      "Cancelamento, reembolso e reagendamento exigem comandos de domínio.",
    ],
    sourceLabel: "bookings",
    title: "Sessões",
  },
  support: {
    description:
      "Acompanhe tickets e urgência operacional sem abrir conteúdo sensível por padrão.",
    emptyMessage: "Nenhum ticket acessível para a sessão administrativa atual.",
    metrics: [
      metric(
        "total-support",
        "Tickets",
        "Tickets registrados.",
        "support_tickets",
        "info",
      ),
      metric(
        "open-support",
        "Abertos",
        "Tickets ainda abertos.",
        "support_tickets",
        "warning",
      ),
      metric(
        "urgent-support",
        "Urgentes",
        "Tickets marcados como urgentes.",
        "support_tickets",
        "danger",
      ),
    ],
    safetyNotes: [
      "A descrição completa do ticket não aparece nesta lista.",
      "Resolver/reabrir usa comando auditado; resposta e escalação seguem fora desta fase.",
    ],
    sourceLabel: "support_tickets",
    title: "Suporte",
  },
  verifications: {
    description:
      "Acompanhe verificações de terapeutas sem expor documentos privados em payload de lista.",
    emptyMessage:
      "Nenhuma verificação acessível para a sessão administrativa atual.",
    metrics: [
      metric(
        "total-verifications",
        "Verificações",
        "Processos registrados.",
        "therapist_verifications",
        "info",
      ),
      metric(
        "pending-verifications",
        "Pendentes",
        "Verificações em análise ou ajuste.",
        "therapist_verifications",
        "warning",
      ),
    ],
    safetyNotes: [
      "Metadados de documentos privados não são carregados nesta lista.",
      "Aprovar, reprovar ou solicitar ajuste usa comando com motivo e auditoria.",
    ],
    sourceLabel: "therapist_verifications",
    title: "Verificações",
  },
};

export const getAdminOperationPage = cache(async function getAdminOperationPage({
  accessToken,
  module,
}: {
  accessToken: string;
  module: AdminOperationModuleKey;
}): Promise<AdminOperationPageResult> {
  const config = getSupabasePublicConfig();
  const spec = MODULES[module];

  if (!config) {
    return {
      message: "Configuração Supabase ausente para carregar este módulo.",
      status: "error",
    };
  }

  const readResult = await fetchAdminOperationReadModel({
    accessToken,
    config,
    module,
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
        generatedAt: new Date().toISOString(),
        metrics: spec.metrics.map((metricSpec) =>
          unavailableMetric(metricSpec, readResult.status),
        ),
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
      metrics: spec.metrics.map((metricSpec) =>
        availableMetric(metricSpec, metricsPayload),
      ),
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
        message: "Configuração Supabase ausente para carregar este detalhe.",
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

    return {
      data: mapAdminOperationDetail({
        auditEvents: Array.isArray(readResult.model.auditEvents)
          ? readResult.model.auditEvents
          : [],
        generatedAt:
          asString(readResult.model.generatedAt) ?? new Date().toISOString(),
        module,
        record: readResult.model.record,
      }),
      status: "success",
    };
  },
);

async function fetchAdminOperationReadModel({
  accessToken,
  config,
  module,
}: {
  accessToken: string;
  config: { apiKey: string; url: string },
  module: AdminOperationModuleKey;
}): Promise<AdminOperationReadResult> {
  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_get_operation_module_v1`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          p_limit: 12,
          p_module: module,
          p_offset: 0,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
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
