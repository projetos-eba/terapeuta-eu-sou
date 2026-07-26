import { execFileSync } from "node:child_process";
import { loadZoomEnv, zoomEnvStatus } from "./env-loader.mjs";

loadZoomEnv();

const status = getLocalSupabaseStatus();
const requiredPath = "/functions/v1/zoom-webhook";
const localEndpoint = `${status.API_URL}${requiredPath}`;
const checks = {
  endpointPath: requiredPath,
  localEndpoint,
  ngrokAuthtoken: process.env.NGROK_AUTHTOKEN ? "configurado" : "ausente",
  supabaseLocal: Boolean(status.API_URL && status.SERVICE_ROLE_KEY),
  zoomEnv: zoomEnvStatus().operations.webhook,
};

console.log(JSON.stringify(checks, null, 2));

function getLocalSupabaseStatus() {
  return JSON.parse(
    execFileSync(statusCommand(), statusArgs(), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
}

function statusCommand() {
  return process.platform === "win32" ? "powershell.exe" : "npx";
}

function statusArgs() {
  return process.platform === "win32"
    ? ["-NoProfile", "-Command", "npx supabase status -o json"]
    : ["supabase", "status", "-o", "json"];
}
