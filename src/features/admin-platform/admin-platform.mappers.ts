import type {
  AdminIntegrationHealth,
  AdminOperationalSignal,
  AdminOperationalStatus,
  AdminSecurityReviewItem,
} from "./admin-platform.types";

type IntegrationInput = {
  description: string;
  key: AdminIntegrationHealth["key"];
  label: string;
  signals: AdminOperationalSignal[];
};

export function buildIntegrationHealth({
  description,
  key,
  label,
  signals,
}: IntegrationInput): AdminIntegrationHealth {
  return {
    description,
    key,
    label,
    signals,
    status: resolveSignalStatus(signals),
  };
}

export function resolveSignalStatus(
  signals: AdminOperationalSignal[],
): AdminOperationalStatus {
  if (signals.length === 0) return "configuration_missing";
  if (signals.some((signal) => signal.status === "unavailable")) {
    return "unavailable";
  }
  if (signals.some((signal) => signal.status === "manual")) {
    return "manual_review";
  }
  if (
    signals.some(
      (signal) =>
        signal.status === "available" &&
        signal.tone === "danger" &&
        (signal.value ?? 0) > 0,
    )
  ) {
    return "degraded";
  }
  if (
    signals.some(
      (signal) =>
        signal.status === "available" &&
        signal.tone === "warning" &&
        (signal.value ?? 0) > 0,
    )
  ) {
    return "degraded";
  }

  return "healthy";
}

export function buildModuleSignals({
  enabledCount,
  hiddenCount,
}: {
  enabledCount: number;
  hiddenCount: number;
}): AdminOperationalSignal[] {
  return [
    {
      description: "Módulos disponíveis na navegação administrativa.",
      key: "enabled-admin-modules",
      label: "Módulos habilitados",
      source: "adminModuleRegistry",
      status: "available",
      tone: "success",
      value: enabledCount,
    },
    {
      description: "Módulos planejados ainda ocultos para evitar links mortos.",
      key: "hidden-admin-modules",
      label: "Módulos ocultos",
      source: "adminModuleRegistry",
      status: "available",
      tone: hiddenCount > 0 ? "warning" : "success",
      value: hiddenCount,
    },
  ];
}

export function buildSecurityReviewItems(): AdminSecurityReviewItem[] {
  return [
    {
      description:
        "Security Advisor local apontou views públicas com SECURITY DEFINER. Revisar contrato antes de declarar admin 100%.",
      key: "security-definer-views",
      label: "Views públicas SECURITY DEFINER",
      severity: "warning",
      source: "Supabase Security Advisor",
      status: "manual_review",
    },
    {
      description:
        "Há funções SECURITY DEFINER executáveis por authenticated. Classificar por domínio antes de alterar grants.",
      key: "authenticated-security-definer-functions",
      label: "Funções privilegiadas expostas",
      severity: "warning",
      source: "Supabase Security Advisor",
      status: "manual_review",
    },
    {
      description:
        "Algumas tabelas com RLS não possuem policies e devem permanecer service-role only ou receber read model admin dedicado.",
      key: "rls-enabled-no-policy",
      label: "RLS sem policy em tabelas internas",
      severity: "info",
      source: "Supabase Security Advisor",
      status: "manual_review",
    },
  ];
}
