import { existsSync, readFileSync } from "node:fs";

const envFiles = [
  "supabase/functions/.env",
  "supabase/functions/.env.local",
  ".env.local",
];

export function loadZoomVideoSdkEnv() {
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

export function zoomVideoSdkEnvStatus() {
  const variables = Object.fromEntries(
    [
      "ZOOM_VIDEO_SDK_KEY",
      "ZOOM_VIDEO_SDK_SECRET",
      "ZOOM_VIDEO_SDK_API_KEY",
      "ZOOM_VIDEO_SDK_API_SECRET",
      "ZOOM_WEBHOOK_SECRET_TOKEN",
      "ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES",
      "ZOOM_ENVIRONMENT",
      "ALLOW_REAL_ZOOM",
    ].map((name) => [name, envState(name)]),
  );

  return {
    allowRealZoom: process.env.ALLOW_REAL_ZOOM === "true",
    checks: {
      apiCredentials:
        variables.ZOOM_VIDEO_SDK_API_KEY === "configurado" &&
        variables.ZOOM_VIDEO_SDK_API_SECRET === "configurado",
      sdkCredentials:
        variables.ZOOM_VIDEO_SDK_KEY === "configurado" &&
        variables.ZOOM_VIDEO_SDK_SECRET === "configurado",
      webhook: variables.ZOOM_WEBHOOK_SECRET_TOKEN === "configurado",
      maxDuration:
        variables.ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES === "configurado",
    },
    variables,
  };
}

export function assertRealZoomAllowed() {
  if (process.env.ALLOW_REAL_ZOOM !== "true") {
    console.log(
      JSON.stringify(
        {
          allowed: false,
          reason: "ALLOW_REAL_ZOOM diferente de true",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return false;
  }

  return true;
}

function envState(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return "ausente";
  if (name === "ALLOW_REAL_ZOOM") {
    return value === "true" || value === "false" ? value : "invalido";
  }
  if (name === "ZOOM_ENVIRONMENT") {
    return ["development", "production"].includes(value) ? value : "invalido";
  }
  if (name === "ZOOM_VIDEO_SESSION_MAX_DURATION_MINUTES") {
    return /^[1-9][0-9]*$/.test(value) && Number(value) <= 240
      ? "configurado"
      : "invalido";
  }

  return "configurado";
}
