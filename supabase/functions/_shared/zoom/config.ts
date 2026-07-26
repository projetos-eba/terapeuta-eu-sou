import type { EdgeRuntime } from "../auth/runtime.ts";
import { DomainError } from "../payments/http.ts";
import type { ZoomConfig, ZoomConfigStatus, ZoomEnvironment } from "./types.ts";

type EnvReader = { get(name: string): string | undefined };

export function getZoomConfig(runtime: EdgeRuntime): ZoomConfig {
  return getZoomConfigFromEnv(runtime.env);
}

export function getZoomConfigFromEnv(env: EnvReader): ZoomConfig {
  const environment = parseZoomEnvironment(env.get("ZOOM_ENVIRONMENT"));
  const config = {
    accountId: required(env, "ZOOM_ACCOUNT_ID"),
    apiBaseUrl: "https://api.zoom.us",
    defaultHostUserId: required(env, "ZOOM_DEFAULT_HOST_USER_ID"),
    environment,
    meetingSdkClientId: required(env, "ZOOM_MEETING_SDK_CLIENT_ID"),
    meetingSdkClientSecret: required(env, "ZOOM_MEETING_SDK_CLIENT_SECRET"),
    s2sClientId: required(env, "ZOOM_S2S_CLIENT_ID"),
    s2sClientSecret: required(env, "ZOOM_S2S_CLIENT_SECRET"),
    webhookSecretToken: required(env, "ZOOM_WEBHOOK_SECRET_TOKEN"),
  };

  if (!/^[A-Za-z0-9._@:-]+$/.test(config.defaultHostUserId)) {
    throw new DomainError(
      "invalid_zoom_default_host",
      503,
      "Configuracao Zoom invalida.",
    );
  }

  return config;
}

export function auditZoomEnv(env: EnvReader) {
  const names = [
    "ZOOM_ACCOUNT_ID",
    "ZOOM_S2S_CLIENT_ID",
    "ZOOM_S2S_CLIENT_SECRET",
    "ZOOM_MEETING_SDK_CLIENT_ID",
    "ZOOM_MEETING_SDK_CLIENT_SECRET",
    "ZOOM_DEFAULT_HOST_USER_ID",
    "ZOOM_WEBHOOK_SECRET_TOKEN",
    "ZOOM_ENVIRONMENT",
  ] as const;

  const variables = Object.fromEntries(
    names.map((name) => [name, statusFor(name, env.get(name))]),
  ) as Record<(typeof names)[number], ZoomConfigStatus>;

  const operations = {
    meetingApi:
      variables.ZOOM_ACCOUNT_ID === "configurado" &&
      variables.ZOOM_S2S_CLIENT_ID === "configurado" &&
      variables.ZOOM_S2S_CLIENT_SECRET === "configurado" &&
      variables.ZOOM_DEFAULT_HOST_USER_ID === "configurado",
    oauth:
      variables.ZOOM_ACCOUNT_ID === "configurado" &&
      variables.ZOOM_S2S_CLIENT_ID === "configurado" &&
      variables.ZOOM_S2S_CLIENT_SECRET === "configurado",
    realTest: env.get("ALLOW_REAL_ZOOM_TESTS")?.toLowerCase() === "true",
    sdkJwt:
      variables.ZOOM_MEETING_SDK_CLIENT_ID === "configurado" &&
      variables.ZOOM_MEETING_SDK_CLIENT_SECRET === "configurado",
    webhook: variables.ZOOM_WEBHOOK_SECRET_TOKEN === "configurado",
    zak:
      variables.ZOOM_ACCOUNT_ID === "configurado" &&
      variables.ZOOM_S2S_CLIENT_ID === "configurado" &&
      variables.ZOOM_S2S_CLIENT_SECRET === "configurado" &&
      variables.ZOOM_DEFAULT_HOST_USER_ID === "configurado",
  };

  return { operations, variables };
}

export function parseZoomEnvironment(
  value: string | undefined,
): ZoomEnvironment {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "development") return "development";
  if (normalized === "production") return "production";

  throw new DomainError(
    "invalid_zoom_environment",
    503,
    "Configuracao Zoom invalida.",
  );
}

function required(env: EnvReader, name: string) {
  const value = env.get(name)?.trim();

  if (!value) {
    throw new DomainError(
      "missing_zoom_env",
      503,
      "Configuracao Zoom ausente.",
    );
  }

  return value;
}

function statusFor(name: string, value: string | undefined): ZoomConfigStatus {
  if (!value?.trim()) return "ausente";
  if (name === "ZOOM_ENVIRONMENT") {
    return value === "development" || value === "production"
      ? "configurado"
      : "invalido";
  }

  return "configurado";
}
