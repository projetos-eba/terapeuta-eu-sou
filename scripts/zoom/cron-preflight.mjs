import { execFileSync } from "node:child_process";
import fs from "node:fs";

const schedulePath = "supabase/schedules/zoom-jobs-cron.sql";
const status = getLocalSupabaseStatus();
const template = fs.readFileSync(schedulePath, "utf8");

console.log(
  JSON.stringify(
    {
      cronTemplate: schedulePath,
      interval: "every_minute",
      localSupabase: Boolean(status.API_URL),
      noHardcodedSecret: !template.includes(
        "PAYMENTS_INTERNAL_OPERATIONS_TOKEN",
      ),
      remoteActivationRequired: true,
      usesPgCron: template.includes("cron.schedule"),
      usesPgNet: template.includes("net.http_post"),
      usesVaultPlaceholder: template.includes("vault.decrypted_secret"),
    },
    null,
    2,
  ),
);

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
