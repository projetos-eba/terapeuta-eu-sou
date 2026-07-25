import {
  getRuntime,
  getServiceRoleKey,
  getSiteUrl,
  type EdgeRuntime,
} from "../auth/runtime.ts";
import { DomainError } from "./http.ts";

export function getPaymentsRuntime(name: string) {
  return getRuntime(name);
}

export type StripeApiKeyMode = "live" | "test";

export function getPaymentsConfig(runtime: EdgeRuntime) {
  const supabaseUrl = runtime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey(runtime);
  const stripeApiKey = runtime.env.get("STRIPE_SECRET_KEY")?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new DomainError(
      "missing_supabase_env",
      503,
      "Configuracao Supabase ausente.",
    );
  }

  if (!stripeApiKey) {
    throw new DomainError(
      "missing_stripe_env",
      503,
      "Configuracao Stripe ausente: defina STRIPE_SECRET_KEY.",
    );
  }

  if (stripeApiKey.startsWith("pk_")) {
    throw new DomainError(
      "invalid_stripe_secret_key",
      503,
      "Configuracao Stripe invalida: STRIPE_SECRET_KEY nao pode usar chave publicavel pk_.",
    );
  }

  if (!isSupportedStripeApiKey(stripeApiKey)) {
    throw new DomainError(
      "invalid_stripe_secret_key",
      503,
      "Configuracao Stripe invalida: use uma chave sk_ ou rk_ em STRIPE_SECRET_KEY.",
    );
  }

  const stripeMode = getStripeApiKeyMode(stripeApiKey);

  if (stripeMode === "live" && isLocalSupabaseUrl(supabaseUrl)) {
    throw new DomainError(
      "stripe_live_key_not_allowed_locally",
      503,
      "Configuracao Stripe invalida: nao use chave live no Supabase local.",
    );
  }

  return {
    environment: stripeMode,
    serviceRoleKey,
    siteUrl: getSiteUrl(runtime),
    stripeApiKey,
    stripeMode,
    supabaseUrl,
  };
}

export function getWebhookSecret(
  runtime: EdgeRuntime,
  name:
    | "STRIPE_PLATFORM_WEBHOOK_SECRET"
    | "STRIPE_CONNECT_WEBHOOK_SECRET"
    | "STRIPE_CONNECT_V2_WEBHOOK_SECRET",
) {
  const explicit = runtime.env.get(name);
  const connectFallback =
    name === "STRIPE_CONNECT_V2_WEBHOOK_SECRET"
      ? runtime.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")
      : null;
  const fallback = runtime.env.get("STRIPE_WEBHOOK_SECRET");
  const value = explicit ?? connectFallback ?? fallback;

  if (!value) {
    throw new DomainError(
      "missing_webhook_secret",
      503,
      "Configuracao de webhook ausente.",
    );
  }

  if (!explicit && value) {
    console.warn(
      JSON.stringify({
        code: "PAYMENTS_WEBHOOK_SECRET_FALLBACK",
        message:
          "Using STRIPE_WEBHOOK_SECRET fallback for endpoint-specific webhook secret.",
        secret_name: name,
      }),
    );
  }

  return value;
}

function isSupportedStripeApiKey(value: string) {
  return /^(sk|rk)_(test|live)_/.test(value);
}

function getStripeApiKeyMode(value: string): StripeApiKeyMode {
  return value.includes("_live_") ? "live" : "test";
}

function isLocalSupabaseUrl(value: string) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(value);
}
