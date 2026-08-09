import "server-only";

import { cache } from "react";

import { getAdminTherapyCatalogPage } from "@/features/admin-therapy-catalog/admin-therapy-catalog.queries";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type {
  AdminDashboard,
  AdminDashboardAlert,
  AdminDashboardEvent,
  AdminDashboardMetric,
  AdminDashboardModule,
  AdminDashboardTone,
} from "./admin-dashboard.types";
import { parseContentRangeTotal } from "./admin-dashboard.utils";

type CountSpec = {
  description: string;
  key: string;
  label: string;
  query: string;
  source: string;
  tone: AdminDashboardTone;
};

type CountResult = CountSpec & {
  status: "available" | "unavailable";
  value: number | null;
};

type TherapyCatalogEventRow = {
  actor_role?: string | null;
  created_at?: string | null;
  entity_type?: string | null;
  event_type?: string | null;
  id?: string | null;
  reason?: string | null;
};

export type AdminDashboardPageResult =
  | {
      dashboard: AdminDashboard;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    };

export const getAdminDashboardPage = cache(
  async function getAdminDashboardPage({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<AdminDashboardPageResult> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Configuração Supabase ausente para carregar a visão geral.",
        status: "error",
      };
    }

    const [catalogResult, countResults, events] = await Promise.all([
      getAdminTherapyCatalogPage({ accessToken }),
      fetchCountResults(config, accessToken),
      fetchRecentEvents(config, accessToken),
    ]);

    const catalogModule = buildCatalogModule(catalogResult);
    const operationModule = buildOperationModule(countResults);
    const financeModule = buildFinanceModule(countResults);
    const integrationModule = buildIntegrationModule(countResults);
    const alerts = buildAlerts({
      catalogModule,
      countResults,
      integrationModule,
    });
    const settingsModule = buildSettingsModule();

    return {
      dashboard: {
        alerts,
        events,
        generatedAt: new Date().toISOString(),
        modules: [
          catalogModule,
          operationModule,
          financeModule,
          integrationModule,
          settingsModule,
        ],
        summary: [
          ...catalogModule.metrics,
          ...operationModule.metrics,
          ...financeModule.metrics,
          ...integrationModule.metrics,
        ]
          .filter((metric) =>
            [
              "published-therapies",
              "pending-therapy-requests",
              "pending-therapists",
              "future-sessions",
              "pending-session-payments",
              "failed-webhooks",
            ].includes(metric.key),
          )
          .slice(0, 6),
      },
      status: "success",
    };
  },
);

async function fetchCountResults(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  return Promise.all(
    getCountSpecs().map(async (spec): Promise<CountResult> => {
      const value = await fetchCount(config, accessToken, spec.query);

      return {
        ...spec,
        status: value === null ? "unavailable" : "available",
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

async function fetchRecentEvents(
  config: { apiKey: string; url: string },
  accessToken: string,
): Promise<AdminDashboardEvent[]> {
  try {
    const response = await fetch(
      `${config.url}/rest/v1/therapy_catalog_events?select=id,actor_role,entity_type,event_type,reason,created_at&order=created_at.desc&limit=6`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) return [];

    const rows = (await response
      .json()
      .catch(() => [])) as TherapyCatalogEventRow[];

    return rows
      .map((row) => ({
        actorRole: row.actor_role ?? "admin",
        createdAt: row.created_at ?? "",
        entityType: row.entity_type ?? "therapy",
        eventType: row.event_type ?? "evento",
        id: row.id ?? crypto.randomUUID(),
        reason: row.reason ?? null,
      }))
      .filter((event) => event.createdAt);
  } catch {
    return [];
  }
}

function buildCatalogModule(
  catalogResult: Awaited<ReturnType<typeof getAdminTherapyCatalogPage>>,
): AdminDashboardModule {
  if (catalogResult.status === "error") {
    return {
      description:
        "Catálogo canônico, solicitações de terapias e integridade do Match.",
      href: routes.admin.therapies,
      key: "catalog",
      label: "Catálogo e Match",
      metrics: [
        unavailableMetric(
          "published-therapies",
          "Terapias publicadas",
          "Falha ao carregar catálogo admin.",
          "admin-therapy-catalog-command",
          "warning",
        ),
      ],
      status: "degraded",
    };
  }

  const catalog = catalogResult.catalog;
  const publishedCount = catalog.items.filter(
    (therapy) => therapy.status === "published" && therapy.isPubliclyVisible,
  ).length;
  const draftCount = catalog.items.filter(
    (therapy) => therapy.status === "draft" || therapy.status === "in_review",
  ).length;
  const matchingVisibleCount = catalog.items.filter(
    (therapy) => therapy.isVisibleInMatching,
  ).length;
  const pendingRequests = catalog.requests.filter((request) =>
    ["submitted", "under_review", "needs_information"].includes(request.status),
  ).length;

  return {
    description:
      "Catálogo canônico, solicitações de terapias e integridade do Match.",
    href: routes.admin.therapies,
    key: "catalog",
    label: "Catálogo e Match",
    metrics: [
      metric(
        "published-therapies",
        "Terapias publicadas",
        publishedCount,
        "Conteúdo público disponível.",
        "admin-therapy-catalog-command",
        "success",
      ),
      metric(
        "draft-therapies",
        "Rascunhos e revisão",
        draftCount,
        "Itens ainda fora da vitrine pública.",
        "admin-therapy-catalog-command",
        "warning",
      ),
      metric(
        "matching-visible-therapies",
        "Visíveis no Match",
        matchingVisibleCount,
        "Terapias ativas na jornada pública.",
        "admin-therapy-catalog-command",
        "info",
      ),
      metric(
        "pending-therapy-requests",
        "Solicitações pendentes",
        pendingRequests,
        "Pedidos de novas terapias aguardando decisão.",
        "therapy_catalog_requests",
        pendingRequests > 0 ? "warning" : "success",
      ),
    ],
    status: "ready",
  };
}

function buildOperationModule(
  countResults: CountResult[],
): AdminDashboardModule {
  return moduleFromCounts({
    countResults,
    description:
      "Base operacional sem detalhes clínicos: profissionais, pacientes e sessões.",
    href: routes.admin.sessions,
    keys: [
      "active-therapists",
      "pending-therapists",
      "active-patients",
      "future-sessions",
      "attention-sessions",
      "open-support-tickets",
    ],
    label: "Operação",
    key: "operation",
  });
}

function buildFinanceModule(countResults: CountResult[]): AdminDashboardModule {
  return moduleFromCounts({
    countResults,
    description:
      "Sinais financeiros separados por sessão, assinatura, refund, dispute e repasse.",
    href: routes.admin.payments,
    keys: [
      "pending-session-payments",
      "paid-session-payments",
      "pending-refunds",
      "open-disputes",
      "open-payout-batches",
      "attention-subscriptions",
    ],
    label: "Financeiro",
    key: "finance",
  });
}

function buildIntegrationModule(
  countResults: CountResult[],
): AdminDashboardModule {
  return moduleFromCounts({
    countResults,
    description:
      "Alertas técnicos de Stripe, Zoom, e-mail e conta de recebimento, sem secrets.",
    href: routes.admin.integrations,
    keys: [
      "failed-webhooks",
      "failed-zoom-webhooks",
      "failed-video-sessions",
      "failed-emails",
      "restricted-connect-accounts",
      "active-subscriptions",
    ],
    label: "Integrações",
    key: "integrations",
  });
}

function buildSettingsModule(): AdminDashboardModule {
  return {
    description:
      "Governança de produto, operação, flags e integrações sem expor secrets.",
    href: routes.admin.settings,
    key: "settings",
    label: "Configurações",
    metrics: [
      metric(
        "admin-settings-governance",
        "Governança",
        1,
        "Página admin de configurações habilitada.",
        "adminModuleRegistry",
        "success",
      ),
      metric(
        "admin-secrets-readonly",
        "Secrets protegidos",
        1,
        "Sem editor de secrets no navegador.",
        "AGENTS.md",
        "success",
      ),
    ],
    status: "ready",
  };
}

function moduleFromCounts({
  countResults,
  description,
  href,
  key,
  keys,
  label,
}: {
  countResults: CountResult[];
  description: string;
  href?: string;
  key: string;
  keys: string[];
  label: string;
}): AdminDashboardModule {
  const metrics = keys.map((metricKey) => {
    const found = countResults.find((result) => result.key === metricKey);

    return found
      ? toMetric(found)
      : unavailableMetric(
          metricKey,
          metricKey,
          "Métrica não configurada.",
          "admin-dashboard",
          "neutral",
        );
  });

  return {
    description,
    href,
    key,
    label,
    metrics,
    status: metrics.every((item) => item.status === "available")
      ? "ready"
      : "degraded",
  };
}

function buildAlerts({
  catalogModule,
  countResults,
  integrationModule,
}: {
  catalogModule: AdminDashboardModule;
  countResults: CountResult[];
  integrationModule: AdminDashboardModule;
}) {
  const alerts: AdminDashboardAlert[] = [];
  const valueByKey = new Map(
    countResults.map((result) => [result.key, result.value]),
  );

  if (catalogModule.status === "degraded") {
    alerts.push({
      description:
        "A visão geral não conseguiu carregar o contrato administrativo de terapias.",
      href: routes.admin.therapies,
      key: "catalog-degraded",
      label: "Catálogo em modo degradado",
      severity: "warning",
    });
  }

  const failedStripe = valueByKey.get("failed-webhooks") ?? 0;
  const failedZoom = valueByKey.get("failed-zoom-webhooks") ?? 0;
  const failedEmails = valueByKey.get("failed-emails") ?? 0;
  const attentionSubscriptions = valueByKey.get("attention-subscriptions") ?? 0;

  if (failedStripe > 0 || failedZoom > 0 || failedEmails > 0) {
    alerts.push({
      description:
        "Há falhas recentes em provedores críticos. Revise logs operacionais sem expor payload sensível.",
      href: routes.admin.integrations,
      key: "integration-failures",
      label: "Falhas de integração",
      severity: "critical",
    });
  }

  if (attentionSubscriptions > 0) {
    alerts.push({
      description:
        "Existem assinaturas em estado de cobrança incompleta, inadimplente ou sem pagamento.",
      key: "subscription-attention",
      label: "Assinaturas exigem atenção",
      severity: "warning",
    });
  }

  if (integrationModule.status === "degraded") {
    alerts.push({
      description:
        "Algumas contagens técnicas não puderam ser lidas com a sessão administrativa atual.",
      href: routes.admin.integrations,
      key: "integration-degraded",
      label: "Leitura técnica parcial",
      severity: "info",
    });
  }

  return alerts;
}

function metric(
  key: string,
  label: string,
  value: number,
  description: string,
  source: string,
  tone: AdminDashboardTone,
): AdminDashboardMetric {
  return {
    description,
    key,
    label,
    source,
    status: "available",
    tone,
    value,
  };
}

function unavailableMetric(
  key: string,
  label: string,
  description: string,
  source: string,
  tone: AdminDashboardTone,
): AdminDashboardMetric {
  return {
    description,
    key,
    label,
    source,
    status: "unavailable",
    tone,
    value: null,
  };
}

function toMetric(result: CountResult): AdminDashboardMetric {
  return result.status === "available" && result.value !== null
    ? metric(
        result.key,
        result.label,
        result.value,
        result.description,
        result.source,
        result.tone,
      )
    : unavailableMetric(
        result.key,
        result.label,
        result.description,
        result.source,
        result.tone,
      );
}

function getCountSpecs(): CountSpec[] {
  const now = encodeURIComponent(new Date().toISOString());

  return [
    {
      description: "Profissionais aprovados no cadastro.",
      key: "active-therapists",
      label: "Profissionais ativos",
      query: "therapist_profiles?status=eq.approved",
      source: "therapist_profiles",
      tone: "success",
    },
    {
      description: "Profissionais aguardando análise ou ajustes.",
      key: "pending-therapists",
      label: "Profissionais pendentes",
      query: "therapist_profiles?status=in.(draft,submitted,in_review)",
      source: "therapist_profiles",
      tone: "warning",
    },
    {
      description: "Pacientes cadastrados na plataforma.",
      key: "active-patients",
      label: "Pacientes ativos",
      query: "patient_profiles",
      source: "patient_profiles",
      tone: "info",
    },
    {
      description: "Sessões futuras com reserva criada.",
      key: "future-sessions",
      label: "Sessões futuras",
      query: `bookings?starts_at=gte.${now}`,
      source: "bookings",
      tone: "info",
    },
    {
      description: "Sessões em estado que pede acompanhamento operacional.",
      key: "attention-sessions",
      label: "Sessões com atenção",
      query:
        "bookings?status=in.(pending_payment,no_show_patient,no_show_therapist,refunded)",
      source: "bookings",
      tone: "warning",
    },
    {
      description: "Tickets de suporte ainda abertos.",
      key: "open-support-tickets",
      label: "Tickets abertos",
      query: "support_tickets?status=eq.open",
      source: "support_tickets",
      tone: "warning",
    },
    {
      description: "Pagamentos de sessão aguardando confirmação financeira.",
      key: "pending-session-payments",
      label: "Pagamentos pendentes",
      query: "session_payments?financial_status=eq.pending",
      source: "session_payments",
      tone: "warning",
    },
    {
      description: "Pagamentos confirmados por autoridade financeira.",
      key: "paid-session-payments",
      label: "Sessões pagas",
      query: "session_payments?financial_status=in.(paid,partially_refunded)",
      source: "session_payments",
      tone: "success",
    },
    {
      description: "Reembolsos ainda não concluídos.",
      key: "pending-refunds",
      label: "Refunds pendentes",
      query: "session_refunds?status=eq.pending",
      source: "session_refunds",
      tone: "warning",
    },
    {
      description: "Disputas sem encerramento registrado.",
      key: "open-disputes",
      label: "Disputes abertas",
      query: "session_disputes?closed_at=is.null",
      source: "session_disputes",
      tone: "danger",
    },
    {
      description: "Lotes de repasse ainda em aberto ou processamento.",
      key: "open-payout-batches",
      label: "Lotes de repasse",
      query: "payout_batches?status=in.(draft,open,processing)",
      source: "payout_batches",
      tone: "info",
    },
    {
      description: "Assinaturas pagas ativas ou em trial.",
      key: "active-subscriptions",
      label: "Assinaturas ativas",
      query: "therapist_subscriptions?status=in.(trialing,active)",
      source: "therapist_subscriptions",
      tone: "success",
    },
    {
      description: "Assinaturas com pagamento ou ativação incompleta.",
      key: "attention-subscriptions",
      label: "Assinaturas em atenção",
      query: "therapist_subscriptions?status=in.(past_due,unpaid,incomplete)",
      source: "therapist_subscriptions",
      tone: "warning",
    },
    {
      description: "Webhooks Stripe com processamento falho.",
      key: "failed-webhooks",
      label: "Falhas Stripe",
      query: "stripe_webhook_events?processing_status=eq.failed",
      source: "stripe_webhook_events",
      tone: "danger",
    },
    {
      description: "Webhooks Zoom Video SDK com processamento falho.",
      key: "failed-zoom-webhooks",
      label: "Falhas Zoom",
      query: "zoom_video_webhook_events?processing_status=eq.failed",
      source: "zoom_video_webhook_events",
      tone: "danger",
    },
    {
      description: "Sessões Zoom marcadas como falhas.",
      key: "failed-video-sessions",
      label: "Sessões Zoom falhas",
      query: "video_sessions?status=eq.failed",
      source: "video_sessions",
      tone: "danger",
    },
    {
      description: "E-mails transacionais com erro de entrega.",
      key: "failed-emails",
      label: "Falhas de e-mail",
      query: "email_delivery_logs?status=eq.error",
      source: "email_delivery_logs",
      tone: "danger",
    },
    {
      description: "Contas Connect ainda restritas ou incompletas.",
      key: "restricted-connect-accounts",
      label: "Connect restrito",
      query: "therapist_connect_accounts?operational_status=neq.active",
      source: "therapist_connect_accounts",
      tone: "warning",
    },
  ];
}
