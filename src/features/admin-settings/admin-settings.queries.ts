import "server-only";

import { cache } from "react";

import { adminModuleRegistry } from "@/features/admin-shell/admin-shell-config";
import { routes } from "@/lib/routes";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type {
  AdminReleaseCheck,
  AdminSettingsGroup,
  AdminSettingsPageResult,
  AdminSettingsSignal,
} from "./admin-settings.types";

type TelemetryHealth = {
  counters: {
    acceptedEvents: number;
    duplicateEvents: number;
    failedRequests: number;
    invalidRequests: number;
    rateLimitedRequests: number;
  };
  lastActivityAt: string | null;
  lastCheckedAt: string | null;
  retentionDays: 120;
  state: "attention" | "disabled" | "no_activity" | "ready";
};

export const getAdminSettingsPage = cache(
  async function getAdminSettingsPage(
    accessToken?: string,
  ): Promise<AdminSettingsPageResult> {
    const supabasePublicConfig = getSupabasePublicConfig();
    const telemetryHealth = accessToken
      ? await queryTelemetryHealth(accessToken).catch(() => null)
      : null;
    const enabledModules = adminModuleRegistry.filter(
      (module) => module.status === "enabled",
    );
    const hiddenModules = adminModuleRegistry.filter(
      (module) => module.status === "hidden",
    );

    return {
      data: {
        generatedAt: new Date().toISOString(),
        groups: [
          buildProductGroup(),
          buildOperationalGroup({ enabledModules: enabledModules.length }),
          buildFeatureFlagGroup(telemetryHealth),
          buildIntegrationGroup({
            hasSupabasePublicConfig: Boolean(supabasePublicConfig),
          }),
        ],
        releaseChecks: buildReleaseChecks({
          enabledModules: enabledModules.length,
          hiddenModules: hiddenModules.length,
          hasSupabasePublicConfig: Boolean(supabasePublicConfig),
        }),
        secretPolicy: [
          "Credenciais e chaves privadas não são exibidas nem alteradas nesta área.",
          "A administração acompanha apenas a situação operacional de cada recurso.",
          "Mudanças críticas seguem revisão, registro administrativo e validação antes de serem liberadas.",
        ],
      },
      status: "success",
    };
  },
);

export function buildReleaseChecks({
  enabledModules,
  hiddenModules,
  hasSupabasePublicConfig,
}: {
  enabledModules: number;
  hiddenModules: number;
  hasSupabasePublicConfig: boolean;
}): AdminReleaseCheck[] {
  return [
    {
      description:
        hiddenModules === 0
          ? "Todas as áreas administrativas planejadas estão disponíveis no menu."
          : "Algumas áreas administrativas ainda não estão disponíveis no menu.",
      key: "navigation-complete",
      label: "Menu sem links mortos",
      status: hiddenModules === 0 ? "healthy" : "manual_review",
    },
    {
      description: `${enabledModules} áreas exigem acesso administrativo autenticado.`,
      key: "server-session",
      label: "Acesso administrativo",
      status: "healthy",
    },
    {
      description: hasSupabasePublicConfig
        ? "Conexão de dados disponível para consultas autenticadas."
        : "A conexão de dados precisa de atenção antes da operação.",
      key: "supabase-public-config",
      label: "Conexão de dados",
      status: hasSupabasePublicConfig ? "healthy" : "configuration_missing",
    },
    {
      description:
        "Alterações de Catálogo e Match passam por validação antes de chegar às jornadas públicas.",
      key: "catalog-command-gate",
      label: "Catálogo e Match com comando",
      status: "healthy",
    },
    {
      description:
        "Pagamentos, assinaturas e relatórios permanecem protegidos contra alterações diretas.",
      key: "financial-read-only",
      label: "Dinheiro protegido",
      status: "manual_review",
    },
  ];
}

function buildProductGroup(): AdminSettingsGroup {
  return {
    description:
      "Políticas de produto que orientam as jornadas públicas e áreas autenticadas.",
    items: [
      signal(
        "online-only",
        "Atendimento online-only",
        "A plataforma oferece atendimentos exclusivamente online em todas as jornadas.",
        "Política da plataforma",
        "healthy",
        "success",
      ),
      signal(
        "plan-capabilities",
        "Planos e permissões",
        "Free, Premium e Premium Plus seguem regras de acesso consistentes.",
        "src/lib/permissions.ts",
        "healthy",
        "success",
      ),
      signal(
        "responsible-copy",
        "Copy responsável",
        "Configuração não permite prometer cura, diagnóstico ou resultado garantido.",
        "AGENTS.md",
        "healthy",
        "success",
      ),
    ],
    key: "product",
    title: "Produto",
  };
}

function buildOperationalGroup({
  enabledModules,
}: {
  enabledModules: number;
}): AdminSettingsGroup {
  return {
    description:
      "Acompanhamento das áreas administrativas e ações que exigem registro.",
    items: [
      signal(
        "enabled-modules",
        "Módulos habilitados",
        `${enabledModules} áreas disponíveis no menu administrativo.`,
        "Configuração da plataforma",
        "healthy",
        "success",
      ),
      signal(
        "catalog-revalidation",
        "Atualização entre áreas",
        "Mudanças no catálogo atualizam terapias, profissionais, Match e jornada pública.",
        "Catálogo e jornada pública",
        "healthy",
        "success",
      ),
      signal(
        "critical-actions",
        "Ações críticas",
        "Suspensão, verificações, suporte e moderação exigem motivo e registro administrativo.",
        "Política administrativa",
        "manual_review",
        "warning",
      ),
    ],
    key: "operation",
    title: "Operação",
  };
}

function buildFeatureFlagGroup(
  telemetryHealth: TelemetryHealth | null,
): AdminSettingsGroup {
  const demoEnabled = process.env.TES_ENABLE_DEMO_DATA === "true";

  return {
    description:
      "Recursos que podem alterar a experiência visível da plataforma.",
    items: [
      signal(
        "demo-data",
        "Conteúdo de apoio",
        demoEnabled
          ? "Conteúdo de apoio está ativo e precisa de acompanhamento."
          : "Conteúdo de apoio está desativado.",
        "Configuração de conteúdo",
        demoEnabled ? "manual_review" : "healthy",
        demoEnabled ? "warning" : "success",
      ),
      telemetrySignal(telemetryHealth),
      signal(
        "report-exports",
        "Relatórios administrativos",
        "Exportações administrativas exigem autorização e registro da ação.",
        "Revisão de acesso",
        "manual_review",
        "warning",
      ),
    ],
    key: "feature-flags",
    title: "Recursos monitorados",
  };
}

async function queryTelemetryHealth(accessToken: string): Promise<TelemetryHealth> {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  const response = await fetch(
    `${config.url}/rest/v1/rpc/admin_get_therapist_metrics_telemetry_health_v1`,
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
  if (!response.ok) throw new Error("TELEMETRY_HEALTH_UNAVAILABLE");

  return parseTelemetryHealth((await response.json()) as unknown);
}

function telemetrySignal(health: TelemetryHealth | null): AdminSettingsSignal {
  if (!health) {
    return signal(
      "public-metrics-telemetry",
      "Descoberta e funil",
      "Não foi possível atualizar esta leitura agora. Nenhuma configuração é alterada nesta área.",
      "Acompanhamento interno",
      "unavailable",
      "neutral",
    );
  }

  const state = {
    attention: {
      description:
        "A coleta precisa de conferência antes de seguir. Os registros expiram em 120 dias.",
      status: "degraded" as const,
      tone: "warning" as const,
    },
    disabled: {
      description:
        "A coleta está preparada e permanece desligada neste ambiente. A ativação é feita somente por operação interna registrada.",
      status: "manual_review" as const,
      tone: "info" as const,
    },
    no_activity: {
      description:
        "A coleta está ativa e ainda não recebeu registros. Os dados aparecem após períodos completos e expiram em 120 dias.",
      status: "manual_review" as const,
      tone: "info" as const,
    },
    ready: {
      description:
        "A coleta está ativa e a leitura agregada está dentro do esperado. Os registros expiram em 120 dias.",
      status: "healthy" as const,
      tone: "success" as const,
    },
  }[health.state];

  return {
    ...signal(
      "public-metrics-telemetry",
      "Descoberta e funil",
      health.lastActivityAt
        ? `${state.description} Última atividade em ${formatDateTime(health.lastActivityAt)}.`
        : state.description,
      "Acompanhamento interno",
      state.status,
      state.tone,
    ),
    metrics: [
      { label: "Recebidos", value: health.counters.acceptedEvents },
      { label: "Repetições evitadas", value: health.counters.duplicateEvents },
      { label: "Envios inválidos", value: health.counters.invalidRequests },
      { label: "Limites aplicados", value: health.counters.rateLimitedRequests },
      { label: "Falhas", value: health.counters.failedRequests },
    ],
  };
}

function parseTelemetryHealth(input: unknown): TelemetryHealth {
  if (!isRecord(input) || input.contractVersion !== 1 || !isRecord(input.counters)) {
    throw new Error("INVALID_TELEMETRY_HEALTH_CONTRACT");
  }

  const state = input.state;
  if (
    state !== "attention" &&
    state !== "disabled" &&
    state !== "no_activity" &&
    state !== "ready"
  ) {
    throw new Error("INVALID_TELEMETRY_HEALTH_STATE");
  }
  if (input.retentionDays !== 120) {
    throw new Error("INVALID_TELEMETRY_RETENTION");
  }

  return {
    counters: {
      acceptedEvents: nonNegativeInteger(input.counters.acceptedEvents),
      duplicateEvents: nonNegativeInteger(input.counters.duplicateEvents),
      failedRequests: nonNegativeInteger(input.counters.failedRequests),
      invalidRequests: nonNegativeInteger(input.counters.invalidRequests),
      rateLimitedRequests: nonNegativeInteger(input.counters.rateLimitedRequests),
    },
    lastActivityAt: nullableDateTime(input.lastActivityAt),
    lastCheckedAt: nullableDateTime(input.lastCheckedAt),
    retentionDays: 120,
    state,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("INVALID_TELEMETRY_COUNTER");
  }
  return value;
}

function nullableDateTime(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error("INVALID_TELEMETRY_DATE");
  }
  return value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function buildIntegrationGroup({
  hasSupabasePublicConfig,
}: {
  hasSupabasePublicConfig: boolean;
}): AdminSettingsGroup {
  return {
    description:
      "Serviços conectados são apresentados por situação operacional, sem expor credenciais.",
    items: [
      signal(
        "supabase-public",
        "Conexão de dados",
        hasSupabasePublicConfig
          ? "Conexão principal disponível para consultas autenticadas."
          : "Conexão principal precisa de atenção.",
        "Acesso seguro aos dados",
        hasSupabasePublicConfig ? "healthy" : "configuration_missing",
        hasSupabasePublicConfig ? "success" : "warning",
      ),
      signal(
        "stripe-secrets",
        "Pagamentos",
        "Pagamentos e assinaturas são acompanhados sem exibir credenciais privadas.",
        "Proteção de pagamentos",
        "manual_review",
        "warning",
      ),
      signal(
        "zoom-secrets",
        "Encontros online",
        "Sessões online usam credenciais protegidas fora desta área administrativa.",
        "Proteção de encontros",
        "manual_review",
        "warning",
      ),
      signal(
        "email-secrets",
        "E-mails transacionais",
        "Configure eventos, remetentes e acompanhe o histórico de envios sem expor credenciais privadas.",
        "Proteção de comunicações",
        "manual_review",
        "warning",
        {
          actionLabel: "Gerenciar e-mails",
          href: routes.admin.emailManagement,
        },
      ),
    ],
    key: "integrations",
    title: "Integrações",
  };
}

function signal(
  key: string,
  label: string,
  description: string,
  source: string,
  status: AdminSettingsSignal["status"],
  tone: AdminSettingsSignal["tone"],
  navigation?: Pick<AdminSettingsSignal, "actionLabel" | "href">,
): AdminSettingsSignal {
  return {
    ...navigation,
    description,
    key,
    label,
    source,
    status,
    tone,
  };
}
