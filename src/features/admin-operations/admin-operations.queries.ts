import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { parseContentRangeTotal } from "../admin-dashboard/admin-dashboard.utils";
import { mapAdminOperationRows } from "./admin-operations.mappers";
import type {
  AdminOperationMetric,
  AdminOperationModuleKey,
  AdminOperationPageData,
  AdminOperationPageResult,
} from "./admin-operations.types";

type CountSpec = {
  description: string;
  key: string;
  label: string;
  query: string;
  source: string;
  tone: AdminOperationMetric["tone"];
};

type ModuleSpec = {
  description: string;
  emptyMessage: string;
  metrics: CountSpec[];
  rowsQuery: string;
  safetyNotes: string[];
  sourceLabel: string;
  title: string;
};

const MODULES: Record<AdminOperationModuleKey, ModuleSpec> = {
  patients: {
    description:
      "Acompanhe a base de clientes com dados operacionais mínimos e sem conteúdo clínico.",
    emptyMessage: "Nenhum cliente acessível para a sessão administrativa atual.",
    metrics: [
      metric("total-patients", "Clientes", "Base cadastrada.", "patient_profiles", "patient_profiles", "info"),
      metric(
        "recent-patients",
        "Novos no período",
        "Cadastros dos últimos 30 dias.",
        `patient_profiles?created_at=gte.${thirtyDaysAgo()}`,
        "patient_profiles",
        "success",
      ),
    ],
    rowsQuery:
      "patient_profiles?select=id,user_id,display_name,timezone,created_at,updated_at&order=created_at.desc&limit=12",
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
      metric("total-professionals", "Profissionais", "Perfis de terapeuta.", "therapist_profiles", "therapist_profiles", "info"),
      metric(
        "approved-professionals",
        "Aprovados",
        "Profissionais com cadastro aprovado.",
        "therapist_profiles?status=eq.approved",
        "therapist_profiles",
        "success",
      ),
      metric(
        "public-professionals",
        "Publicados",
        "Perfis públicos ativos.",
        "therapist_profiles?is_public=eq.true",
        "therapist_profiles",
        "success",
      ),
      metric(
        "booking-professionals",
        "Recebendo reservas",
        "Profissionais aceitando reservas.",
        "therapist_profiles?is_accepting_bookings=eq.true",
        "therapist_profiles",
        "info",
      ),
    ],
    rowsQuery:
      "therapist_profiles?select=id,public_name,slug,plan,status,public_status,is_public,is_accepting_bookings,created_at,updated_at&order=updated_at.desc&limit=12",
    safetyNotes: [
      "Suspensão, reativação e publicação exigem comando com motivo, versão esperada e auditoria.",
      "Plano de assinatura não deve ser alterado diretamente pelo admin.",
    ],
    sourceLabel: "therapist_profiles",
    title: "Profissionais",
  },
  reviews: {
    description:
      "Monitore avaliações para moderação sem expor comentários em listagem operacional.",
    emptyMessage: "Nenhuma avaliação acessível para a sessão administrativa atual.",
    metrics: [
      metric("total-reviews", "Avaliações", "Registros recebidos.", "reviews", "reviews", "info"),
      metric("published-reviews", "Publicadas", "Avaliações públicas.", "reviews?status=eq.published", "reviews", "success"),
      metric("pending-reviews", "Pendentes", "Avaliações aguardando revisão.", "reviews?status=in.(pending,reported)", "reviews", "warning"),
    ],
    rowsQuery:
      "reviews?select=id,rating,status,moderation_reason,published_at,created_at,updated_at&order=created_at.desc&limit=12",
    safetyNotes: [
      "Comentários não aparecem na lista para reduzir exposição desnecessária.",
      "Ocultar/restaurar avaliação deve preservar original e recalcular projeções públicas.",
    ],
    sourceLabel: "reviews",
    title: "Avaliações",
  },
  sessions: {
    description:
      "Acompanhe reservas, pagamento e janela online sem expor URL secreta de reunião.",
    emptyMessage: "Nenhuma sessão acessível para a sessão administrativa atual.",
    metrics: [
      metric("total-sessions", "Sessões", "Reservas registradas.", "bookings", "bookings", "info"),
      metric(
        "future-sessions",
        "Futuras",
        "Sessões com início futuro.",
        `bookings?starts_at=gte.${encodeURIComponent(new Date().toISOString())}`,
        "bookings",
        "info",
      ),
      metric(
        "attention-sessions",
        "Atenção",
        "Sessões com status operacional sensível.",
        "bookings?status=in.(pending_payment,no_show_patient,no_show_therapist,refunded)",
        "bookings",
        "warning",
      ),
    ],
    rowsQuery:
      "bookings?select=id,status,payment_status,starts_at,ends_at,timezone,service_title_snapshot,service_duration_minutes_snapshot,created_at,updated_at&order=starts_at.desc&limit=12",
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
      metric("total-support", "Tickets", "Tickets registrados.", "support_tickets", "support_tickets", "info"),
      metric("open-support", "Abertos", "Tickets ainda abertos.", "support_tickets?status=eq.open", "support_tickets", "warning"),
      metric("urgent-support", "Urgentes", "Tickets marcados como urgentes.", "support_tickets?urgency=in.(high,critical)", "support_tickets", "danger"),
    ],
    rowsQuery:
      "support_tickets?select=id,subject,category,status,priority,urgency,source,created_at,updated_at&order=created_at.desc&limit=12",
    safetyNotes: [
      "A descrição completa do ticket não aparece nesta lista.",
      "Responder, escalar e resolver exigem trilha de auditoria dedicada.",
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
      metric("total-verifications", "Verificações", "Processos registrados.", "therapist_verifications", "therapist_verifications", "info"),
      metric(
        "pending-verifications",
        "Pendentes",
        "Verificações em análise ou ajuste.",
        "therapist_verifications?status=in.(submitted,in_review,changes_requested)",
        "therapist_verifications",
        "warning",
      ),
    ],
    rowsQuery:
      "therapist_verifications?select=id,therapist_profile_id,status,submitted_at,reviewed_at,created_at,updated_at&order=submitted_at.desc&limit=12",
    safetyNotes: [
      "Metadados de documentos privados não são carregados nesta lista.",
      "Aprovar, reprovar ou solicitar ajuste exige comando com motivo e auditoria.",
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

  const [metrics, rowsResult] = await Promise.all([
    fetchMetrics(config, accessToken, spec.metrics),
    fetchRows(config, accessToken, spec.rowsQuery),
  ]);

  return {
    data: {
      description: spec.description,
      emptyMessage: spec.emptyMessage,
      generatedAt: new Date().toISOString(),
      metrics,
      rows: rowsResult.status === "available"
        ? mapAdminOperationRows({ module, rows: rowsResult.rows })
        : [],
      rowsStatus: rowsResult.status,
      rowsUnavailableMessage:
        rowsResult.status === "unavailable"
          ? "A leitura foi bloqueada ou falhou. Isso não é tratado como lista vazia."
          : undefined,
      safetyNotes: spec.safetyNotes,
      sourceLabel: spec.sourceLabel,
      title: spec.title,
    },
    status: "success",
  };
});

async function fetchMetrics(
  config: { apiKey: string; url: string },
  accessToken: string,
  specs: CountSpec[],
) {
  return Promise.all(
    specs.map(async (spec): Promise<AdminOperationMetric> => {
      const value = await fetchCount(config, accessToken, spec.query);

      return {
        description: spec.description,
        key: spec.key,
        label: spec.label,
        source: spec.source,
        status: value === null ? "unavailable" : "available",
        tone: spec.tone,
        value,
      };
    }),
  );
}

async function fetchCount(
  config: { apiKey: string; url: string },
  accessToken: string,
  query: string,
) {
  try {
    const separator = query.includes("?") ? "&" : "?";
    const response = await fetch(
      `${config.url}/rest/v1/${query}${separator}select=id&limit=1`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "count=exact",
        },
      },
    );

    if (!response.ok) return null;

    return parseContentRangeTotal(response.headers.get("content-range"));
  } catch {
    return null;
  }
}

async function fetchRows(
  config: { apiKey: string; url: string },
  accessToken: string,
  query: string,
): Promise<{ rows: unknown[]; status: "available" } | { status: "unavailable" }> {
  try {
    const response = await fetch(`${config.url}/rest/v1/${query}`, {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return { status: "unavailable" };

    const rows = await response.json().catch(() => null);

    return Array.isArray(rows)
      ? { rows, status: "available" }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

function metric(
  key: string,
  label: string,
  description: string,
  query: string,
  source: string,
  tone: AdminOperationMetric["tone"],
): CountSpec {
  return {
    description,
    key,
    label,
    query,
    source,
    tone,
  };
}

function thirtyDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 30);

  return encodeURIComponent(date.toISOString());
}
