import "server-only";

import { cache } from "react";

import { adminModuleRegistry } from "@/features/admin-shell/admin-shell-config";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type {
  AdminReleaseCheck,
  AdminSettingsGroup,
  AdminSettingsPageResult,
  AdminSettingsSignal,
} from "./admin-settings.types";

export const getAdminSettingsPage = cache(
  async function getAdminSettingsPage(): Promise<AdminSettingsPageResult> {
    const supabasePublicConfig = getSupabasePublicConfig();
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
          buildFeatureFlagGroup(),
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
        "ADR-009 / AGENTS.md",
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
        "adminModuleRegistry",
        "healthy",
        "success",
      ),
      signal(
        "catalog-revalidation",
        "Revalidação cross-shell",
        "Mudanças no catálogo atualizam terapias, profissionais, Match e jornada pública.",
        "/api/admin/therapies",
        "healthy",
        "success",
      ),
      signal(
        "critical-actions",
        "Ações críticas",
        "Suspensão, verificações, suporte e moderação exigem motivo e registro administrativo.",
        "docs/architecture/admin-plan.md",
        "manual_review",
        "warning",
      ),
    ],
    key: "operation",
    title: "Operação",
  };
}

function buildFeatureFlagGroup(): AdminSettingsGroup {
  const demoEnabled = process.env.TES_ENABLE_DEMO_DATA === "true";

  return {
    description:
      "Recursos que podem alterar a experiência visível da plataforma.",
    items: [
      signal(
        "demo-data",
        "Dados demonstrativos",
        demoEnabled
          ? "Conteúdo demonstrativo está ativo e precisa de acompanhamento."
          : "Conteúdo demonstrativo está desativado.",
        "TES_ENABLE_DEMO_DATA",
        demoEnabled ? "manual_review" : "healthy",
        demoEnabled ? "warning" : "success",
      ),
      signal(
        "public-metrics-telemetry",
        "Telemetria pública",
        "Permanece condicionada à validação de privacidade, aviso e retenção.",
        "therapist_metrics_runtime_config",
        "manual_review",
        "warning",
      ),
      signal(
        "report-exports",
        "Exports admin",
        "Exportações administrativas exigem autorização e registro da ação.",
        "Fase 4 / Fase 5",
        "manual_review",
        "warning",
      ),
    ],
    key: "feature-flags",
    title: "Recursos monitorados",
  };
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
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        hasSupabasePublicConfig ? "healthy" : "configuration_missing",
        hasSupabasePublicConfig ? "success" : "warning",
      ),
      signal(
        "stripe-secrets",
        "Stripe",
        "Pagamentos e assinaturas são acompanhados sem exibir credenciais privadas.",
        "docs/payments/stripe-secrets-setup.md",
        "manual_review",
        "warning",
      ),
      signal(
        "zoom-secrets",
        "Zoom",
        "Sessões online usam credenciais protegidas fora desta área administrativa.",
        "docs/zoom/production-readiness.md",
        "manual_review",
        "warning",
      ),
      signal(
        "email-secrets",
        "E-mail",
        "O envio de e-mails usa credenciais protegidas fora desta área administrativa.",
        "supabase/functions/.env.example",
        "manual_review",
        "warning",
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
): AdminSettingsSignal {
  return {
    description,
    key,
    label,
    source,
    status,
    tone,
  };
}
