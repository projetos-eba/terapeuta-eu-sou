import type { EdgeRuntime } from "../auth/runtime.ts";
import { ZoomVideoSdkError } from "./errors.ts";

export type ZoomVideoSdkEnvironment = "development" | "production";

export type ZoomVideoSdkConfig = {
  allowRealZoom: boolean;
  apiKey: string;
  apiSecret: string;
  environment: ZoomVideoSdkEnvironment;
  sdkKey: string;
  sdkSecret: string;
  webhookSecretToken: string;
};

export function getZoomVideoSdkConfig(
  runtime: EdgeRuntime,
): ZoomVideoSdkConfig {
  return {
    allowRealZoom: parseStrictBoolean(runtime.env.get("ALLOW_REAL_ZOOM")),
    apiKey: requireEnv(runtime, "ZOOM_VIDEO_SDK_API_KEY"),
    apiSecret: requireEnv(runtime, "ZOOM_VIDEO_SDK_API_SECRET"),
    environment: getZoomEnvironment(runtime.env.get("ZOOM_ENVIRONMENT")),
    sdkKey: requireEnv(runtime, "ZOOM_VIDEO_SDK_KEY"),
    sdkSecret: requireEnv(runtime, "ZOOM_VIDEO_SDK_SECRET"),
    webhookSecretToken: requireEnv(runtime, "ZOOM_WEBHOOK_SECRET_TOKEN"),
  };
}

export function parseStrictBoolean(value: string | undefined) {
  if (value === undefined || value.trim() === "") return false;
  if (value.trim() === "true") return true;
  if (value.trim() === "false") return false;

  return false;
}

function requireEnv(runtime: EdgeRuntime, name: string) {
  const value = runtime.env.get(name)?.trim();
  if (!value) {
    throw new ZoomVideoSdkError(
      `missing_${name.toLowerCase()}`,
      503,
      "Configuracao Zoom Video SDK ausente.",
    );
  }

  return value;
}

function getZoomEnvironment(
  value: string | undefined,
): ZoomVideoSdkEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "production") return "production";
  if (normalized === "development") return "development";
  if (!normalized) return "development";

  throw new ZoomVideoSdkError(
    "invalid_zoom_environment",
    503,
    "Configuracao Zoom Video SDK invalida.",
  );
}
