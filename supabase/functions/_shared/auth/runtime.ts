export type EdgeRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

export function getRuntime(name: string) {
  const runtime = (globalThis as typeof globalThis & { Deno?: EdgeRuntime })
    .Deno;

  if (!runtime) {
    throw new Error(`${name} requires the Supabase Edge Runtime.`);
  }

  return runtime;
}

export function getServiceRoleKey(runtime: EdgeRuntime) {
  const serviceRoleKey = runtime.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (isLocalSupabaseUrl(runtime.env.get("SUPABASE_URL")) && serviceRoleKey) {
    return serviceRoleKey;
  }

  return (
    getDefaultKey(runtime.env.get("SUPABASE_SECRET_KEYS")) ??
      runtime.env.get("SUPABASE_SECRET_KEY") ??
      serviceRoleKey
  );
}

export function getSiteUrl(runtime: EdgeRuntime) {
  return normalizeSiteUrl(
    firstNonEmpty(
      runtime.env.get("EMAIL_PUBLIC_SITE_URL"),
      runtime.env.get("NEXT_PUBLIC_SITE_URL"),
    ) ?? "http://localhost:3000",
  );
}

export function getRateLimitSalt(runtime: EdgeRuntime) {
  return (
    runtime.env.get("EMAIL_RATE_LIMIT_SALT") ??
      runtime.env.get("SUPABASE_JWT_SECRET") ??
      "local-rate-limit-salt"
  );
}

export function parseBooleanEnv(
  value: string | undefined,
  defaultValue = false,
) {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  switch (value.trim().toLowerCase()) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      throw new Error("INVALID_BOOLEAN_ENV");
  }
}

export function isEmailAutomaticallyConfirmed(runtime: EdgeRuntime) {
  return parseBooleanEnv(
    runtime.env.get("CONFIRMED_AUTOMATICALLY_EMAIL"),
    false,
  );
}

export function isLocalMasterPasswordBypassEnabled(
  runtime: EdgeRuntime,
  envName = "MASTER_PASSWORD_BYPASS_ENABLED",
) {
  return (
    parseBooleanEnv(runtime.env.get(envName), false) &&
    isLocalSupabaseUrl(runtime.env.get("SUPABASE_URL"))
  );
}

function getDefaultKey(rawKeys: string | undefined) {
  if (!rawKeys) return null;

  try {
    const keys = JSON.parse(rawKeys) as Record<string, unknown>;
    const defaultKey = keys.default;
    return typeof defaultKey === "string" && defaultKey ? defaultKey : null;
  } catch {
    return null;
  }
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/g, "");
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${isLocalHost(trimmed) ? "http" : "https"}://${trimmed}`;
  const url = new URL(withProtocol);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SITE_URL_INVALID_PROTOCOL");
  }

  return url.toString().replace(/\/+$/g, "");
}

function isLocalHost(value: string) {
  const host = value.split("/")[0]?.split(":")[0]?.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

function isLocalSupabaseUrl(rawUrl: string | undefined) {
  if (!rawUrl) return false;

  try {
    const url = new URL(rawUrl);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}
