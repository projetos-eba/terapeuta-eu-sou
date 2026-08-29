import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { buildIntegrationHealth } from "./admin-platform.mappers";
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

const ADMIN_AUDIT_PAGE_SIZE = 8;

export const getAdminIntegrationsPage = cache(
  async function getAdminIntegrationsPage({
    accessToken,
  }: {
    accessToken: string;
  }): Promise<AdminPlatformPageResult<AdminIntegrationsPageData>> {
    const config = getSupabasePublicConfig();

    if (!config) {
      return {
        message: "Não foi possível carregar as integrações agora.",
        status: "error",
      };
    }

    const readModel = await fetchIntegrationHealthReadModel(
      config,
      accessToken,
    );
    const countResults = readModel.countResults;

    const signal = createSignalLookup(countResults);
    const integrations = [
      buildIntegrationHealth({
        description:
          "Pagamentos, assinaturas, repasses e conferência financeira.",
        key: "stripe",
        label: "Pagamentos",
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
        label: "Conta de recebimento",
        signals: [signal("restricted-connect-accounts")],
      }),
      buildIntegrationHealth({
        description: "Sessões online e participação nos encontros.",
        key: "zoom",
        label: "Encontros online",
        signals: [
          signal("failed-zoom-webhooks"),
          signal("failed-video-sessions"),
        ],
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
  searchParams,
}: {
  accessToken: string;
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<AdminPlatformPageResult<AdminSecurityPageData>> {
  const config = getSupabasePublicConfig();

  if (!config) {
    return {
      message: "Não foi possível carregar a segurança agora.",
      status: "error",
    };
  }

  const page = parseAuditPage(searchParams?.page);
  const auditEventsResult = await fetchRecentAuditEvents(
    config,
    accessToken,
    page,
  );
  return {
    data: {
      auditPage: auditEventsResult.page,
      auditEvents: auditEventsResult.events,
      auditEventsStatus: auditEventsResult.status,
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
  page: number,
) {
  const offset = (page - 1) * ADMIN_AUDIT_PAGE_SIZE;

  try {
    const response = await fetch(
      `${config.url}/rest/v1/admin_audit_events?select=id,actor_role,permission,action,entity_type,reason,source,created_at&order=created_at.desc%2Cid.desc&limit=${ADMIN_AUDIT_PAGE_SIZE}&offset=${offset}`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "count=exact",
        },
      },
    );

    if (!response.ok) {
      return {
        events: [],
        page: emptyAuditPage(page),
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
      page: buildAuditPage(
        response.headers.get("content-range"),
        page,
        rows.length,
      ),
      status: "available" as const,
    };
  } catch {
    return {
      events: [],
      page: emptyAuditPage(page),
      status: "unavailable" as const,
    };
  }
}

function parseAuditPage(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue || !/^\d+$/.test(rawValue)) return 1;

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildAuditPage(
  contentRange: string | null,
  page: number,
  rowCount: number,
) {
  const total = parseAuditTotal(
    contentRange,
    (page - 1) * ADMIN_AUDIT_PAGE_SIZE + rowCount,
  );

  return {
    hasNext: page * ADMIN_AUDIT_PAGE_SIZE < total,
    page,
    pageSize: ADMIN_AUDIT_PAGE_SIZE,
    total,
  };
}

function emptyAuditPage(page: number) {
  return {
    hasNext: false,
    page,
    pageSize: ADMIN_AUDIT_PAGE_SIZE,
    total: 0,
  };
}

function parseAuditTotal(contentRange: string | null, fallback: number) {
  const match = contentRange?.match(/\/(\d+)$/);
  if (!match) return fallback;

  const total = Number.parseInt(match[1], 10);
  return Number.isFinite(total) && total >= 0 ? total : fallback;
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
      description: "Pagamentos com processamento falho.",
      key: "failed-stripe-webhooks",
      label: "Falhas de pagamento",
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
      description: "Contas de recebimento restritas ou incompletas.",
      key: "restricted-connect-accounts",
      label: "Contas restritas",
      source: "admin_get_integration_health_v1",
      tone: "warning",
    },
    {
      description: "Encontros online com processamento falho.",
      key: "failed-zoom-webhooks",
      label: "Falhas em encontros online",
      source: "admin_get_integration_health_v1",
      tone: "danger",
    },
    {
      description: "Sessões online marcadas como falhas.",
      key: "failed-video-sessions",
      label: "Sessões online com falha",
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
