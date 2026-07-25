import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

let supabaseStatusEnvCache = null;

export function loadEnvFiles() {
  for (const file of [
    path.join("supabase", "functions", ".env.local"),
    path.join("supabase", "functions", ".env"),
    ".env.local",
  ]) {
    if (!fs.existsSync(file)) continue;

    const content = fs.readFileSync(file, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) continue;

      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);

      if (!match) continue;

      const [, key, rawValue] = match;

      if (process.env[key]) continue;

      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

export function getStripeSecretKey() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();

  if (!value) return null;

  if (value.startsWith("pk_")) {
    throw new Error(
      "STRIPE_SECRET_KEY cannot use a publishable Stripe key starting with pk_.",
    );
  }

  if (!/^(sk|rk)_(test|live)_/.test(value)) {
    throw new Error(
      "STRIPE_SECRET_KEY must be a Stripe API key starting with sk_ or rk_.",
    );
  }

  return value;
}

export function getStripeMode(secretKey = getStripeSecretKey()) {
  if (!secretKey) return null;

  return secretKey.includes("_live_") ? "live" : "test";
}

export function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ??
    getSupabaseStatusEnv().API_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321"
  ).replace(/\/+$/g, "");
}

export function assertStripeModeAllowedForSupabaseUrl({
  stripeMode = getStripeMode(),
  supabaseUrl = getSupabaseUrl(),
} = {}) {
  if (stripeMode === "live" && isLocalSupabaseUrl(supabaseUrl)) {
    throw new Error(
      "Refusing to use a live Stripe key against the local Supabase API.",
    );
  }
}

export function getSupabaseAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function getSupabaseServiceRoleKey() {
  const explicit =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

  if (explicit?.trim()) return explicit.trim();

  return getSupabaseStatusEnv().SERVICE_ROLE_KEY ?? null;
}

export function requireSupabaseServiceRoleKey() {
  const value = getSupabaseServiceRoleKey();

  if (!value) {
    throw new Error(
      "Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY for remote sync or run Supabase locally.",
    );
  }

  return value;
}

function isLocalSupabaseUrl(value) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(value);
}

function getSupabaseStatusEnv() {
  if (supabaseStatusEnvCache) return supabaseStatusEnvCache;

  try {
    const output = execFileSync("npx supabase status -o env", {
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const values = {};

    for (const line of output.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.+)$/i.exec(line.trim());

      if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }

    supabaseStatusEnvCache = values;
    return values;
  } catch {
    supabaseStatusEnvCache = {};
    return supabaseStatusEnvCache;
  }
}
