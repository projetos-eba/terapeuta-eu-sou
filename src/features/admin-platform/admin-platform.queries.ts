import "server-only";

import { cache } from "react";

import { adminModuleRegistry } from "@/features/admin-shell/admin-shell-config";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import {
  buildIntegrationHealth,
  buildModuleSignals,
  buildSecurityReviewItems,
} from "./admin-platform.mappers";
import type {
  AdminIntegrationsPageData,
  AdminOperationalSignal,
  AdminOperationalTone,
  AdminPlatformPageResult,
  AdminSecurityPageData,
} from "./admin-platform.types";

type CountSpec = {
  description: string;
  key: string;
  label: string;
  source: string;
  tone: AdminOperationalTone;
};

type CountResult = CountSpec & {
  status: "available" | "unavailable";
  value: number | null;
};

type AdminAuditEventRow = {
  action?: string | null;
  actor_role?: string | null;
  created_at?: string | null;
  entity_type?: string | null;
  id?: string | null;
  permission?: string | null;
  reason?: string | null;
  source?: string | null;
};

type IntegrationHealthReadModel = {
  generatedAt?: string | null;
  last?: Record<string, string | null | undefined> | null;
  signals?: Record<string, number | null | undefined> | null;
};

export const getAdminIntegrationsPage = cache(
  async function getAdminIntegrationsPage({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<AdminPlatformPageResult<AdminIntegrationsPageData>> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Configuração Supabase ausente para carregar integrações.",
        status: "error",
      };
    }

    const readModel = await fetchIntegrationHealthReadModel(config, accessToken);
    const countResults = readModel.countResults;

    const signal = createSignalLookup(countResults);
    const integrations = [
      buildIntegrationHealth({
        description:
          "Webhooks de pagamentos, assinaturas, repasses e reconciliação financeira.",
        key: "stripe",
        label: "Stripe",
        signals: [
          signal("failed-stripe-webhooks"),
          signal("attention-subscriptions"),
          signal("pending-session-payments"),
        ],
      }),
      buildIntegrationHealth({
        description:
          "Contas de recebimento de terapeutas e disponibilidade para repasses.",
        key: "connect",
        label: "Stripe Connect",
        signals: [signal("restricted-connect-accounts")],
      }),
      buildIntegrationHealth({
        description:
          "Sessões online, webhooks do Video SDK e eventos de participação.",
        key: "zoom",
        label: "Zoom",
        signals: [signal("failed-zoom-webhooks"), signal("failed-video-sessions")],
      }),
      buildIntegrationHealth({
        description:
          "Envios transacionais de autenticação, agenda, suporte e notificações.",
        key: "email",
        label: "E-mail",
        signals: [signal("failed-emails")],
      }),
    ];

    return {
      data: {
        generatedAt: readModel.generatedAt ?? new Date().toISOString(),
        integrations,
        summary: countResults.map(toSignal),
      },
      status: "success",
    };
  },
);

export const getAdminSecurityPage = cache(async function getAdminSecurityPage({
  accessToken,
}: {
  accessToken: string;
}): Promise<AdminPlatformPageResult<AdminSecurityPageData>> {
  const config = getSupabasePublicConfig();

  if (!config) {
    return {
      message: "Configuração Supabase ausente para carregar segurança.",
      status: "error",
    };
  }

  const [auditEventsResult] = await Promise.all([
    fetchRecentAuditEvents(config, accessToken),
  ]);
  const enabledCount = adminModuleRegistry.filter(
    (module) => module.status === "enabled",
  ).length;
  const hiddenCount = adminModuleRegistry.filter(
    (module) => module.status === "hidden",
  ).length;

  return {
    data: {
      auditEvents: auditEventsResult.events,
      auditEventsStatus: auditEventsResult.status,
      generatedAt: new Date().toISOString(),
      moduleSignals: buildModuleSignals({ enabledCount, hiddenCount }),
      reviewItems: buildSecurityReviewItems(),
    },
    status: "success",
  };
});

async function fetchIntegrationHealthReadModel(
  config: { apiKey: string; url: string },
  accessToken: string,
): Promise<{
  countResults: CountResult[];
  generatedAt: string | null;
}> {
  const specs = getIntegrationCountSpecs();

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/admin_get_integration_health_v1`,
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
        generatedAt: null,
      };
    }

    const payload = (await response
      .json()
      .catch(() => null)) as IntegrationHealthReadModel | null;

    if (!payload || typeof payload !== "object") {
      return {
        countResults: unavailableCountResults(specs),
        generatedAt: null,
      };
    }

    return {
      countResults: specs.map((spec) => {
        const value = payload.signals?.[spec.key];

        return {
          ...spec,
          status: typeof value === "number" ? "available" : "unavailable",
          value: typeof value === "number" ? value : null,
        };
      }),
      generatedAt: payload.generatedAt ?? null,
    };
  } catch {
    return {
      countResults: unavailableCountResults(specs),
      generatedAt: null,
    };
  }
}

async function fetchRecentAuditEvents(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  try {
    const response = await fetch(
      `${config.url}/rest/v1/admin_audit_events?select=id,actor_role,permission,action,entity_type,reason,source,created_at&order=created_at.desc&limit=8`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      return {
        events: [],
        status: "unavailable" as const,
      };
    }

    const rows = (await response
      .json()
      .catch(() => [])) as AdminAuditEventRow[];

    return {
      events: rows
        .map((row) => ({
          actorRole: row.actor_role ?? "admin",
          createdAt: row.created_at ?? "",
          entityType: row.entity_type ?? "therapy",
          eventType: row.action ?? "evento",
          id: row.id ?? crypto.randomUUID(),
          permission: row.permission ?? null,
          reason: row.reason ?? null,
          source: row.source ?? "admin",
        }))
        .filter((event) => event.createdAt),
      status: "available" as const,
    };
  } catch {
    return {
      events: [],
      status: "unavailable" as const,
    };
  }
}

function createSignalLookup(countResults: CountResult[]) {
  const signals = new Map(countResults.map((result) => [result.key, result]));

  return (key: string) => {
    const result = signals.get(key);

    if (!result) {
      return {
        description: "Sinal operacional não configurado.",
        key,
        label: key,
        source: "admin-platform",
        status: "unavailable",
        tone: "neutral",
        value: null,
      } satisfies AdminOperationalSignal;
    }

    return toSignal(result);
  };
}

function toSignal(result: CountResult): AdminOperationalSignal {
  return {
    description: result.description,
    key: result.key,
    label: result.label,
    source: result.source,
    status: result.status,
    tone: result.tone,
    value: result.value,
  };
}

function getIntegrationCountSpecs(): CountSpec[] {
  return [
    {
      description: "Webhooks Stripe com processamento falho.",
      key: "failed-stripe-webhooks",
      label: "Falhas Stripe",
      source: "admin_get_integration_health_v1",
      tone: "danger",
    },
    {
      description: "Assinaturas com pagamento ou ativação incompleta.",
      key: "attention-subscriptions",
      label: "Assinaturas em atenção",
      source: "admin_get_integration_health_v1",
      tone: "warning",
    },
    {
      description: "Pagamentos de sessão aguardando confirmação financeira.",
      key: "pending-session-payments",
      label: "Pagamentos pendentes",
      source: "admin_get_integration_health_v1",
      tone: "warning",
    },
    {
      description: "Contas Connect restritas ou incompletas.",
      key: "restricted-connect-accounts",
      label: "Connect restrito",
      source: "admin_get_integration_health_v1",
      tone: "warning",
    },
    {
      description: "Webhooks Zoom Video SDK com processamento falho.",
      key: "failed-zoom-webhooks",
      label: "Falhas Zoom",
      source: "admin_get_integration_health_v1",
      tone: "danger",
    },
    {
      description: "Sessões Zoom marcadas como falhas.",
      key: "failed-video-sessions",
      label: "Sessões Zoom falhas",
      source: "admin_get_integration_health_v1",
      tone: "danger",
    },
    {
      description: "E-mails transacionais com erro de entrega.",
      key: "failed-emails",
      label: "Falhas de e-mail",
      source: "admin_get_integration_health_v1",
      tone: "danger",
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
