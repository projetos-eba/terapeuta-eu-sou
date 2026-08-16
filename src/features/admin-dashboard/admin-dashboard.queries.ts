import "server-only";

import { cache } from "react";

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

type CountSpec = {
  description: string;
  key: string;
  label: string;
  source: string;
  tone: AdminDashboardTone;
};

type CountResult = CountSpec & {
  status: "available" | "unavailable";
  value: number | null;
};

type DashboardReadModel = {
  events?: DashboardReadModelEvent[];
  generatedAt?: string | null;
  metrics?: Record<string, number | null | undefined> | null;
};

type DashboardReadModelEvent = {
  actorRole?: string | null;
  createdAt?: string | null;
  entityType?: string | null;
  eventType?: string | null;
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
        message: "Não foi possível carregar a visão geral agora.",
        status: "error",
      };
    }

    const readModel = await fetchDashboardReadModel(config, accessToken);
    const countResults = readModel.countResults;
    const events = readModel.events;

    const catalogModule = buildCatalogModule(countResults);
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
        generatedAt: readModel.generatedAt ?? new Date().toISOString(),
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
              "active-therapists",
              "active-patients",
              "future-sessions",
              "paid-session-payments",
              "active-subscriptions",
            ].includes(metric.key),
          )
          .slice(0, 5),
      },
      status: "success",
    };
  },
);

async function fetchDashboardReadModel(
  config: { apiKey: string; url: string },
  accessToken: string,
): Promise<{
  countResults: CountResult[];
  events: AdminDashboardEvent[];
  generatedAt: string | null;
}> {
  const specs = getCountSpecs();

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_get_dashboard_v1`,
      {
        body: "{}",
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      return {
        countResults: unavailableCountResults(specs),
        events: [],
        generatedAt: null,
      };
    }

    const payload = (await response
      .json()
      .catch(() => null)) as DashboardReadModel | null;

    if (!payload || typeof payload !== "object") {
      return {
        countResults: unavailableCountResults(specs),
        events: [],
        generatedAt: null,
      };
    }

    return {
      countResults: specs.map((spec) => {
        const value = payload.metrics?.[spec.key];

        return {
          ...spec,
          status: typeof value === "number" ? "available" : "unavailable",
          value: typeof value === "number" ? value : null,
        };
      }),
      events: mapDashboardEvents(payload.events ?? []),
      generatedAt: payload.generatedAt ?? null,
    };
  } catch {
    return {
      countResults: unavailableCountResults(specs),
      events: [],
      generatedAt: null,
    };
  }
}

function buildCatalogModule(countResults: CountResult[]): AdminDashboardModule {
  return moduleFromCounts({
    description:
      "Catálogo canônico, solicitações de terapias e integridade do Match.",
    href: routes.admin.therapies,
    keys: [
      "published-therapies",
      "draft-therapies",
      "matching-visible-therapies",
      "pending-therapy-requests",
    ],
    key: "catalog",
    label: "Catálogo e Match",
    countResults,
  });
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
      "Pagamentos, assinaturas, reembolsos, disputas e repasses.",
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
      "Pagamentos, vídeo, e-mail e contas de recebimento.",
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
      "Governança de produto, operação e critérios de release.",
    href: routes.admin.settings,
    key: "settings",
    label: "Configurações",
    metrics: [
      metric(
        "admin-settings-governance",
        "Governança",
        1,
        "Área de configurações habilitada.",
        "adminModuleRegistry",
        "success",
      ),
      metric(
        "admin-secrets-readonly",
        "Credenciais protegidas",
        1,
        "Alterações sensíveis permanecem fora da interface.",
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
          "Indicador ainda indisponível.",
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
        "Alguns indicadores do catálogo precisam de nova tentativa de leitura.",
      href: routes.admin.therapies,
      key: "catalog-degraded",
      label: "Catálogo pede atenção",
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
        "Há falhas recentes em integrações críticas. Revise a área responsável.",
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
        "Alguns indicadores de integrações precisam de nova tentativa de leitura.",
      href: routes.admin.integrations,
      key: "integration-degraded",
      label: "Integrações pedem atenção",
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
  return [
    {
      description: "Conteúdo público disponível.",
      key: "published-therapies",
      label: "Terapias publicadas",
      source: "admin_get_dashboard_v1",
      tone: "success",
    },
    {
      description: "Itens ainda fora da vitrine pública.",
      key: "draft-therapies",
      label: "Rascunhos e revisão",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
    {
      description: "Terapias ativas na jornada pública.",
      key: "matching-visible-therapies",
      label: "Visíveis no Match",
      source: "admin_get_dashboard_v1",
      tone: "info",
    },
    {
      description: "Pedidos de novas terapias aguardando decisão.",
      key: "pending-therapy-requests",
      label: "Solicitações pendentes",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
    {
      description: "Profissionais aprovados no cadastro.",
      key: "active-therapists",
      label: "Profissionais ativos",
      source: "admin_get_dashboard_v1",
      tone: "success",
    },
    {
      description: "Profissionais aguardando análise ou ajustes.",
      key: "pending-therapists",
      label: "Profissionais pendentes",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
    {
      description: "Pacientes cadastrados na plataforma.",
      key: "active-patients",
      label: "Pacientes ativos",
      source: "admin_get_dashboard_v1",
      tone: "info",
    },
    {
      description: "Sessões futuras com reserva criada.",
      key: "future-sessions",
      label: "Sessões futuras",
      source: "admin_get_dashboard_v1",
      tone: "info",
    },
    {
      description: "Sessões em estado que pede acompanhamento operacional.",
      key: "attention-sessions",
      label: "Sessões com atenção",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
    {
      description: "Chamados de suporte ainda abertos.",
      key: "open-support-tickets",
      label: "Chamados abertos",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
    {
      description: "Pagamentos de sessão aguardando confirmação financeira.",
      key: "pending-session-payments",
      label: "Pagamentos pendentes",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
    {
      description: "Pagamentos confirmados por autoridade financeira.",
      key: "paid-session-payments",
      label: "Sessões pagas",
      source: "admin_get_dashboard_v1",
      tone: "success",
    },
    {
      description: "Reembolsos ainda não concluídos.",
      key: "pending-refunds",
      label: "Reembolsos pendentes",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
    {
      description: "Disputas sem encerramento registrado.",
      key: "open-disputes",
      label: "Disputas abertas",
      source: "admin_get_dashboard_v1",
      tone: "danger",
    },
    {
      description: "Lotes de repasse ainda em aberto ou processamento.",
      key: "open-payout-batches",
      label: "Lotes de repasse",
      source: "admin_get_dashboard_v1",
      tone: "info",
    },
    {
      description: "Assinaturas pagas ativas ou em trial.",
      key: "active-subscriptions",
      label: "Assinaturas ativas",
      source: "admin_get_dashboard_v1",
      tone: "success",
    },
    {
      description: "Assinaturas com pagamento ou ativação incompleta.",
      key: "attention-subscriptions",
      label: "Assinaturas em atenção",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
    {
      description: "Integrações de pagamento com processamento falho.",
      key: "failed-webhooks",
      label: "Falhas de pagamento",
      source: "admin_get_dashboard_v1",
      tone: "danger",
    },
    {
      description: "Integrações de vídeo com processamento falho.",
      key: "failed-zoom-webhooks",
      label: "Falhas de vídeo",
      source: "admin_get_dashboard_v1",
      tone: "danger",
    },
    {
      description: "Sessões de vídeo marcadas como falhas.",
      key: "failed-video-sessions",
      label: "Sessões de vídeo falhas",
      source: "admin_get_dashboard_v1",
      tone: "danger",
    },
    {
      description: "E-mails transacionais com erro de entrega.",
      key: "failed-emails",
      label: "Falhas de e-mail",
      source: "admin_get_dashboard_v1",
      tone: "danger",
    },
    {
      description: "Contas de recebimento ainda restritas ou incompletas.",
      key: "restricted-connect-accounts",
      label: "Recebimento restrito",
      source: "admin_get_dashboard_v1",
      tone: "warning",
    },
  ];
}

function unavailableCountResults(specs: CountSpec[]): CountResult[] {
  return specs.map((spec) => ({
    ...spec,
    status: "unavailable",
    value: null,
  }));
}

function mapDashboardEvents(
  rows: DashboardReadModelEvent[],
): AdminDashboardEvent[] {
  return rows
    .map((row) => ({
      actorRole: row.actorRole ?? "admin",
      createdAt: row.createdAt ?? "",
      entityType: row.entityType ?? "admin",
      eventType: row.eventType ?? "evento",
      id: row.id ?? crypto.randomUUID(),
      reason: row.reason ?? null,
    }))
    .filter((event) => event.createdAt);
}
