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
          buildIntegrationGroup({ hasSupabasePublicConfig: Boolean(supabasePublicConfig) }),
        ],
        releaseChecks: buildReleaseChecks({
          enabledModules: enabledModules.length,
          hiddenModules: hiddenModules.length,
          hasSupabasePublicConfig: Boolean(supabasePublicConfig),
        }),
        secretPolicy: [
          "Secrets ficam em Supabase Edge Functions, secret manager ou provedor externo, nunca em formulário admin.",
          "O admin pode ver somente estado operacional: configurado, ausente, degradado ou revisão manual.",
          "Mudança de configuração crítica exige PR, deploy controlado, auditoria e validação cross-shell.",
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
          ? "Todas as rotas planejadas no registry estão visíveis no shell."
          : "Ainda há módulos ocultos no registry admin.",
      key: "navigation-complete",
      label: "Menu sem links mortos",
      status: hiddenModules === 0 ? "healthy" : "manual_review",
    },
    {
      description: `${enabledModules} módulos habilitados exigem sessão admin server-side.`,
      key: "server-session",
      label: "Sessão admin server-side",
      status: "healthy",
    },
    {
      description: hasSupabasePublicConfig
        ? "Configuração pública Supabase válida para consultas autenticadas."
        : "Configuração pública Supabase ausente ou placeholder.",
      key: "supabase-public-config",
      label: "Supabase público",
      status: hasSupabasePublicConfig ? "healthy" : "configuration_missing",
    },
    {
      description:
        "Catálogo e Match passam pela Edge Function admin-therapy-catalog-command e revalidam superfícies públicas.",
      key: "catalog-command-gate",
      label: "Catálogo e Match com comando",
      status: "healthy",
    },
    {
      description:
        "Pagamentos, assinaturas e relatórios permanecem read-only até existir comando auditado.",
      key: "financial-read-only",
      label: "Dinheiro protegido",
      status: "manual_review",
    },
  ];
}

function buildProductGroup(): AdminSettingsGroup {
  return {
    description:
      "Configurações de produto que afetam superfícies públicas e shells autenticados.",
    items: [
      signal(
        "online-only",
        "Atendimento online-only",
        "Política canônica ativa por arquitetura; a UI nova oferece somente atendimento online.",
        "ADR-009 / AGENTS.md",
        "healthy",
        "success",
      ),
      signal(
        "plan-capabilities",
        "Planos e permissões",
        "Free, Premium e Premium Plus seguem enums técnicos e permissões centralizadas.",
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
      "Governança operacional do shell admin, auditoria e rotas habilitadas.",
    items: [
      signal(
        "enabled-modules",
        "Módulos habilitados",
        `${enabledModules} módulos expostos no menu administrativo.`,
        "adminModuleRegistry",
        "healthy",
        "success",
      ),
      signal(
        "catalog-revalidation",
        "Revalidação cross-shell",
        "Mutação de catálogo revalida terapias, terapeutas, Match e jornada pública.",
        "/api/admin/therapies",
        "healthy",
        "success",
      ),
      signal(
        "critical-actions",
        "Ações críticas",
        "Suspensão, verificações, suporte e moderação usam comando auditado. Financeiro, sessões e exports seguem bloqueados sem boundary próprio.",
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
      "Flags e runtime que podem alterar comportamento visível da plataforma.",
    items: [
      signal(
        "demo-data",
        "Dados demonstrativos",
        demoEnabled
          ? "Flag server-side ativa. Não usar como sucesso em homologação/produção."
          : "Flag server-side ausente ou desativada.",
        "TES_ENABLE_DEMO_DATA",
        demoEnabled ? "manual_review" : "healthy",
        demoEnabled ? "warning" : "success",
      ),
      signal(
        "public-metrics-telemetry",
        "Telemetria pública",
        "Permanece condicionada a gate formal de base legal, aviso e retenção.",
        "therapist_metrics_runtime_config",
        "manual_review",
        "warning",
      ),
      signal(
        "report-exports",
        "Exports admin",
        "Relatórios reais exigem export server-side auditado e proteção CSV.",
        "Fase 4 / Fase 5",
        "manual_review",
        "warning",
      ),
    ],
    key: "feature-flags",
    title: "Feature Flags",
  };
}

function buildIntegrationGroup({
  hasSupabasePublicConfig,
}: {
  hasSupabasePublicConfig: boolean;
}): AdminSettingsGroup {
  return {
    description:
      "Integrações externas são diagnosticadas por estado, não por valor secreto.",
    items: [
      signal(
        "supabase-public",
        "Supabase público",
        hasSupabasePublicConfig
          ? "URL e publishable key públicas estão configuradas."
          : "URL ou publishable key públicas ausentes/placeholder.",
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        hasSupabasePublicConfig ? "healthy" : "configuration_missing",
        hasSupabasePublicConfig ? "success" : "warning",
      ),
      signal(
        "stripe-secrets",
        "Stripe",
        "Secret key, webhook secrets e Price IDs pertencem às Edge Functions e ao Dashboard Stripe.",
        "docs/payments/stripe-secrets-setup.md",
        "manual_review",
        "warning",
      ),
      signal(
        "zoom-secrets",
        "Zoom",
        "Credenciais Video SDK e webhook secret pertencem às Edge Functions/ambiente remoto.",
        "docs/zoom/production-readiness.md",
        "manual_review",
        "warning",
      ),
      signal(
        "email-secrets",
        "E-mail",
        "Hostinger Mail API e salt de rate limit ficam em secrets remotos.",
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
