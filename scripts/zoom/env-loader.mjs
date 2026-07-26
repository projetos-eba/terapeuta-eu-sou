import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_FILES = [
  "supabase/functions/.env.local",
  "supabase/functions/.env",
  ".env.local",
];

export function loadZoomEnv() {
  for (const relativePath of ENV_FILES) {
    const fullPath = path.join(ROOT, relativePath);
    if (!fs.existsSync(fullPath)) continue;

    const text = fs.readFileSync(fullPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const index = trimmed.indexOf("=");
      if (index === -1) continue;

      const key = trimmed.slice(0, index).trim();
      const value = trimmed
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "");

      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

export function zoomEnvStatus() {
  const required = [
    "ZOOM_ACCOUNT_ID",
    "ZOOM_S2S_CLIENT_ID",
    "ZOOM_S2S_CLIENT_SECRET",
    "ZOOM_MEETING_SDK_CLIENT_ID",
    "ZOOM_MEETING_SDK_CLIENT_SECRET",
    "ZOOM_DEFAULT_HOST_USER_ID",
    "ZOOM_WEBHOOK_SECRET_TOKEN",
    "ZOOM_ENVIRONMENT",
  ];

  const variables = Object.fromEntries(
    required.map((name) => [name, statusFor(name, process.env[name])]),
  );
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
    realTest: process.env.ALLOW_REAL_ZOOM_TESTS === "true",
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

export function statusFor(name, value) {
  if (!value?.trim()) return "ausente";
  if (name === "ZOOM_ENVIRONMENT") {
    return value === "development" || value === "production"
      ? "configurado"
      : "invalido";
  }

  return "configurado";
}

export function sanitizeError(error) {
  return String(error?.message ?? error ?? "UNKNOWN")
    .replace(
      /(access_token|zak|client_secret|password|passcode|start_url|join_url)["'=:\s]+[^"',}\s]+/gi,
      "$1=REDACTED",
    )
    .replace(/https:\/\/[^\s"']+/gi, "URL_REDACTED")
    .slice(0, 300);
}
