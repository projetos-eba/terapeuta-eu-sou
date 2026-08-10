export const DEFAULT_LIVE_AMOUNT_CAP_CENTS = 500;
export const LIVE_CONFIRMATION_VALUE = "LIVE_STRIPE_SMOKE_APPROVED";

export function parseStage(value = "readiness") {
  const stage = String(value || "readiness").trim();
  if (["billing", "connect", "readiness", "report", "session"].includes(stage)) {
    return stage;
  }
  throw new Error("invalid_stage");
}

export function parsePlan(value = "premium") {
  const plan = String(value || "premium").trim();
  if (plan === "premium" || plan === "premium_plus") return plan;
  throw new Error("invalid_plan");
}

export function parsePositiveCentAmount(value, fallback = DEFAULT_LIVE_AMOUNT_CAP_CENTS) {
  const raw = value === undefined || value === null || value === "" ? fallback : value;
  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("invalid_amount_cents");
  }
  return amount;
}

export function getStripeModeFromKey(value) {
  if (!value) return null;
  if (!/^(sk|rk)_(test|live)_/.test(value)) {
    throw new Error("invalid_stripe_secret_key");
  }
  return value.includes("_live_") ? "live" : "test";
}

export function assertLiveStripeMode(stripeSecretKey) {
  const mode = getStripeModeFromKey(stripeSecretKey);
  if (mode !== "live") {
    throw new Error("live_stripe_key_required");
  }
  return mode;
}

export function supabaseProjectRef(value) {
  const host = safeHost(value);
  const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
  return match?.[1] ?? null;
}

export function isLocalSupabaseUrl(value) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(String(value || ""));
}

export function assertProductionSupabaseUrl(value, { hmlRef } = {}) {
  if (!value) throw new Error("supabase_url_required");
  if (isLocalSupabaseUrl(value)) throw new Error("production_supabase_required");
  const ref = supabaseProjectRef(value);
  if (!ref) throw new Error("supabase_project_ref_required");
  if (hmlRef && ref === hmlRef) {
    throw new Error("hml_supabase_not_allowed_for_live");
  }
  return ref;
}

export function assertLiveMoneyGuard({
  args = [],
  env = process.env,
  maxAmountCents = DEFAULT_LIVE_AMOUNT_CAP_CENTS,
  plannedAmountCents,
}) {
  if (!args.includes("--confirm-live-money")) {
    throw new Error("live_money_cli_confirmation_required");
  }
  if (env.TES_LIVE_SMOKE_CONFIRM !== LIVE_CONFIRMATION_VALUE) {
    throw new Error("live_money_env_confirmation_required");
  }

  assertAmountWithinCap({
    amountCents: plannedAmountCents,
    maxAmountCents,
  });
}

export function assertAmountWithinCap({ amountCents, maxAmountCents }) {
  const amount = parsePositiveCentAmount(amountCents);
  const cap = parsePositiveCentAmount(maxAmountCents);
  if (amount > cap) {
    throw new Error("live_amount_cap_exceeded");
  }
  return amount;
}

export function estimateDiscountedAmountCents({
  coupon,
  unitAmountCents,
}) {
  const amount = parsePositiveCentAmount(unitAmountCents);
  if (!coupon) return amount;

  if (Number.isInteger(coupon.amount_off) && coupon.amount_off > 0) {
    return Math.max(0, amount - coupon.amount_off);
  }

  if (typeof coupon.percent_off === "number" && coupon.percent_off > 0) {
    const discounted = amount * (1 - Math.min(coupon.percent_off, 100) / 100);
    return Math.max(0, Math.round(discounted));
  }

  return amount;
}

export function shouldUseLiveSmokeCoupon({
  enabled,
  couponId,
  therapistProfileId,
  therapistProfileIdAllowlist,
}) {
  return (
    enabled === "true" &&
    Boolean(couponId?.trim()) &&
    Boolean(therapistProfileId?.trim()) &&
    therapistProfileIdAllowlist?.trim() === therapistProfileId?.trim()
  );
}

export function maskStripeId(value) {
  if (!value || typeof value !== "string") return null;
  if (!/^(acct|ch|cs|cus|evt|in|pi|price|prod|re|sub|tr|we)_/.test(value)) {
    return value.length <= 8 ? value : `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
  if (value.length <= 12) return value;
  return `${value.slice(0, 7)}...${value.slice(-4)}`;
}

export function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

export function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

export function safeError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown");
  return message
    .replace(/(sk|rk|pk|whsec)_(test|live)?_[A-Za-z0-9_]+/g, "$1_REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer REDACTED");
}
