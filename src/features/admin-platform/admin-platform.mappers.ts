import type {
  AdminIntegrationHealth,
  AdminOperationalSignal,
  AdminOperationalStatus,
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
