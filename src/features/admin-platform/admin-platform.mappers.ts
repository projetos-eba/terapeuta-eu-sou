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
        "A revisão de segurança encontrou áreas públicas que precisam de conferência antes da liberação completa.",
      key: "security-definer-views",
      label: "Áreas públicas em conferência",
      severity: "warning",
      source: "Revisão de segurança",
      status: "manual_review",
    },
    {
      description:
        "Há permissões que precisam de classificação por área antes de qualquer alteração.",
      key: "authenticated-security-definer-functions",
      label: "Funções privilegiadas expostas",
      severity: "warning",
      source: "Revisão de segurança",
      status: "manual_review",
    },
    {
      description:
        "Algumas áreas precisam de regras de acesso específicas antes de serem liberadas.",
      key: "rls-enabled-no-policy",
      label: "Regras de acesso pendentes",
      severity: "info",
      source: "Revisão de segurança",
      status: "manual_review",
    },
  ];
}
