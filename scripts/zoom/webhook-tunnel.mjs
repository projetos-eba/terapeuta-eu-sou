import ngrok from "@ngrok/ngrok";
import { execFileSync } from "node:child_process";
import { loadZoomEnv } from "./env-loader.mjs";

loadZoomEnv();

const status = getLocalSupabaseStatus();
const addr = "http://127.0.0.1:54321/functions/v1/zoom-webhook";

if (!status.API_URL) {
  console.error(JSON.stringify({ error: "supabase_local_unavailable" }));
  process.exit(1);
}

if (!process.env.NGROK_AUTHTOKEN) {
  console.error(JSON.stringify({ error: "NGROK_AUTHTOKEN ausente" }));
  process.exit(1);
}

const listener = await ngrok.forward({
  addr,
  authtoken_from_env: true,
});

console.log(
  JSON.stringify(
    {
      marketplacePath: "/functions/v1/zoom-webhook",
      publicWebhookUrl: listener.url(),
    },
    null,
    2,
  ),
);

process.on("SIGINT", close);
process.on("SIGTERM", close);

await new Promise(() => {});

async function close() {
  await listener.close();
  process.exit(0);
}

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
