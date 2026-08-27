#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const supabaseCliPath = path.join(
  root,
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const runtimeSecrets = [
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PLATFORM_WEBHOOK_SECRET",
  "STRIPE_CONNECT_WEBHOOK_SECRET",
  "STRIPE_CONNECT_V2_WEBHOOK_SECRET",
];
const runtimeOverrides = [
  "EMAIL_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "TES_CONNECT_PAYOUT_SCHEDULE_CHANGES_ENABLED",
  "TES_FINANCE_TEST_CONTROLS_ENABLED",
];

const status = spawnSync(process.execPath, [supabaseCliPath, "status", "-o", "env"], {
  cwd: root,
  encoding: "utf8",
});
if (status.status !== 0) {
  throw new Error(
    "Supabase local indisponível. Execute npx supabase start antes das funções.",
  );
}

const supabaseEnv = parseEnv(status.stdout);
const supabaseUrl = supabaseEnv.API_URL;
const anonKey = supabaseEnv.ANON_KEY;
const serviceRoleKey = supabaseEnv.SERVICE_ROLE_KEY;
if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Supabase local não retornou URL e chaves de runtime obrigatórias.",
  );
}

const baseEnvPath = await resolveBaseEnvFile(root);
const baseEnv = await readFile(baseEnvPath, "utf8");
const baseEnvValues = parseEnv(baseEnv);
const baseKeys = new Set();
const lines = [];

for (const line of baseEnv.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  const key = match?.[1];
  if (
    key &&
    /^SUPABASE_(URL|SERVICE_ROLE_KEY|ANON_KEY|PUBLISHABLE_KEY)$/.test(key)
  ) {
    continue;
  }
  if (key && runtimeOverrides.includes(key)) {
    baseKeys.add(key);
    continue;
  }
  if (key) baseKeys.add(key);
  lines.push(line);
}

for (const key of runtimeSecrets) {
  const value = process.env[key]?.trim();
  if (value && !baseKeys.has(key)) lines.push(`${key}=${value}`);
}

// Stripe CLI signs every locally forwarded payload with its listener secret,
// regardless of which remote destination secret is configured in HML. When
// endpoint-specific Connect secrets aren't present locally, reuse only the
// local platform listener secret inside this transient runtime file.
const localListenerSecret =
  process.env.STRIPE_PLATFORM_WEBHOOK_SECRET?.trim() ||
  baseEnvValues.STRIPE_PLATFORM_WEBHOOK_SECRET?.trim();
if (localListenerSecret) {
  for (const key of [
    "STRIPE_CONNECT_WEBHOOK_SECRET",
    "STRIPE_CONNECT_V2_WEBHOOK_SECRET",
  ]) {
    if (!baseKeys.has(key) && !process.env[key]?.trim()) {
      lines.push(`${key}=${localListenerSecret}`);
    }
  }
}
for (const key of runtimeOverrides) {
  const value = process.env[key]?.trim();
  if (value) lines.push(`${key}=${value}`);
}

const runtimeDir = await mkdtemp(path.join(tmpdir(), "tes-functions-"));
const runtimeEnvPath = path.join(runtimeDir, "functions.env");
await writeFile(runtimeEnvPath, `${lines.join("\n")}\n`, { mode: 0o600 });

const containerName = `supabase_edge_runtime_${path.basename(root)}`;
spawnSync("docker", ["stop", containerName], { cwd: root, stdio: "ignore" });

const child = spawn(
  process.execPath,
  [
    supabaseCliPath,
    "functions",
    "serve",
    "--env-file",
    runtimeEnvPath,
    "--no-verify-jwt",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      SUPABASE_ANON_KEY: anonKey,
      SUPABASE_PUBLISHABLE_KEY: anonKey,
    },
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

const exitCode = await new Promise((resolve) => {
  child.once("exit", (code) => resolve(code ?? 1));
});
await rm(runtimeDir, { recursive: true, force: true });
process.exit(exitCode);

async function resolveBaseEnvFile(cwd) {
  const candidates = [
    path.join(cwd, "supabase", "functions", ".env.local"),
    path.join(cwd, "supabase", "functions", ".env"),
    path.join(cwd, ".env.local"),
  ];
  for (const candidate of candidates) {
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(
    "Arquivo de ambiente local das Edge Functions não encontrado.",
  );
}

function parseEnv(source) {
  const result = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return result;
}
