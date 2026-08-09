import "server-only";

import { cache } from "react";

import { adminModuleRegistry } from "@/features/admin-shell/admin-shell-config";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { parseContentRangeTotal } from "../admin-dashboard/admin-dashboard.utils";
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
  query: string;
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

    const countResults = await fetchCountResults(
      config,
      accessToken,
      getIntegrationCountSpecs(),
    );

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
        generatedAt: new Date().toISOString(),
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

async function fetchCountResults(
  config: { apiKey: string; url: string },
  accessToken: string,
  specs: CountSpec[],
) {
  return Promise.all(
    specs.map(async (spec): Promise<CountResult> => {
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
      query: "stripe_webhook_events?processing_status=eq.failed",
      source: "stripe_webhook_events",
      tone: "danger",
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
      description: "Pagamentos de sessão aguardando confirmação financeira.",
      key: "pending-session-payments",
      label: "Pagamentos pendentes",
      query: "session_payments?financial_status=eq.pending",
      source: "session_payments",
      tone: "warning",
    },
    {
      description: "Contas Connect restritas ou incompletas.",
      key: "restricted-connect-accounts",
      label: "Connect restrito",
      query: "therapist_connect_accounts?operational_status=neq.active",
      source: "therapist_connect_accounts",
      tone: "warning",
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
  ];
}
