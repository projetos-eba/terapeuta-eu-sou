import { execFileSync } from "node:child_process";
import fs from "node:fs";

const schedulePath = "supabase/schedules/zoom-jobs-cron.sql";
const status = getLocalSupabaseStatus();
const template = fs.readFileSync(schedulePath, "utf8");
const expectedJobName = "tes_zoom_jobs_process_every_minute";
const expectedSecretName = "zoom_jobs_process_internal_token";
const expectedHeader = "x-tes-internal-operations-token";
const checks = {
  fileExists: fs.existsSync(schedulePath),
  frequencyEveryMinute: template.includes("'* * * * *'"),
  headerInternalAuth: template.includes(expectedHeader),
  jobName: template.includes(expectedJobName),
  noHardcodedInternalTokenValue: !containsHardcodedInternalTokenValue(template),
  noServiceRoleKey: !/service[_-]?role/i.test(template),
  remoteFunctionUrlPlaceholder: template.includes(
    "https://<PROJECT_REF>.supabase.co/functions/v1/zoom-jobs-process",
  ),
  secretName: template.includes(expectedSecretName),
  usesPgCron:
    template.includes("create extension if not exists pg_cron") &&
    template.includes("cron.schedule"),
  usesPgNet:
    template.includes("create extension if not exists pg_net") &&
    template.includes("net.http_post"),
  usesRemoteEdgeFunctionUrl: template.includes(
    "/functions/v1/zoom-jobs-process",
  ),
  usesVault:
    template.includes("create extension if not exists supabase_vault") &&
    template.includes("vault.decrypted_secrets"),
};
const ok = Object.values(checks).every(Boolean);

console.log(
  JSON.stringify(
    {
      checks,
      cronTemplate: schedulePath,
      interval: "every_minute",
      localSupabase: Boolean(status.API_URL),
      ok,
      remoteActivationRequired: true,
    },
    null,
    2,
  ),
);

if (!ok) process.exitCode = 1;

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

function containsHardcodedInternalTokenValue(value) {
  return /x-tes-internal-operations-token'\s*,\s*'[^']+'/i.test(value);
}
