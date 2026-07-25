import {
  assertStripeModeAllowedForSupabaseUrl,
  getStripeMode,
  getStripeSecretKey,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  loadEnvFiles,
} from "./env-utils.mjs";

loadEnvFiles();

const operation = process.argv[2] ?? "overview";

const checks = {
  catalog: [stripeSecretKeyCheck(), serviceRoleCheck(), supabaseUrlCheck()],
  checkout: [stripeSecretKeyCheck(), supabaseUrlCheck()],
  "connect-webhook": [stripeSecretKeyCheck(), connectWebhookCheck()],
  internal: [internalTokenCheck()],
  overview: [
    stripeSecretKeyCheck(),
    supabaseUrlCheck(),
    anonKeyCheck(),
    serviceRoleInformationalCheck(),
    platformWebhookInformationalCheck(),
    connectWebhookInformationalCheck(),
    internalTokenInformationalCheck(),
  ],
  "platform-webhook": [stripeSecretKeyCheck(), platformWebhookCheck()],
};

const selected = checks[operation];

if (!selected) {
  console.error(
    `Unknown operation "${operation}". Use overview, catalog, checkout, platform-webhook, connect-webhook, or internal.`,
  );
  process.exitCode = 1;
} else {
  const failures = selected.filter((check) => !check.ok);

  console.log(`Payment environment check: ${operation}`);
  for (const check of selected) {
    console.log(`- ${check.name}: ${formatStatus(check)}`);
  }

  if (operation === "overview") {
    const mode = getStripeMode();
    console.log(`Stripe mode: ${mode ?? "not configured"}`);
  }

  if (failures.length > 0) {
    console.error("Payment environment is incomplete for this operation.");
    for (const check of failures) console.error(`- ${check.name}`);
    process.exitCode = 1;
  } else {
    console.log("Payment environment looks complete for this operation.");
  }
}

function stripeSecretKeyCheck() {
  return check("STRIPE_SECRET_KEY", () => {
    const key = getStripeSecretKey();
    assertStripeModeAllowedForSupabaseUrl();

    return Boolean(key);
  });
}

function supabaseUrlCheck() {
  return check("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", () =>
    Boolean(getSupabaseUrl()),
  );
}

function anonKeyCheck() {
  return check("Supabase public API key", () => Boolean(getSupabaseAnonKey()));
}

function serviceRoleCheck() {
  return check("SUPABASE_SERVICE_ROLE_KEY or local service role", () =>
    Boolean(getSupabaseServiceRoleKey()),
  );
}

function serviceRoleInformationalCheck() {
  return {
    ...serviceRoleCheck(),
    level: getSupabaseServiceRoleKey() ? "ok" : "optional",
    ok: true,
  };
}

function platformWebhookCheck() {
  return check("STRIPE_PLATFORM_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET", () =>
    Boolean(
      process.env.STRIPE_PLATFORM_WEBHOOK_SECRET ??
      process.env.STRIPE_WEBHOOK_SECRET,
    ),
  );
}

function connectWebhookCheck() {
  return check("STRIPE_CONNECT_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET", () =>
    Boolean(
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET ??
      process.env.STRIPE_WEBHOOK_SECRET,
    ),
  );
}

function platformWebhookInformationalCheck() {
  return {
    ...platformWebhookCheck(),
    level: platformWebhookCheck().ok ? "ok" : "optional",
    ok: true,
  };
}

function connectWebhookInformationalCheck() {
  return {
    ...connectWebhookCheck(),
    level: connectWebhookCheck().ok ? "ok" : "optional",
    ok: true,
  };
}

function internalTokenCheck() {
  return check("PAYMENTS_INTERNAL_OPERATIONS_TOKEN", () =>
    Boolean(process.env.PAYMENTS_INTERNAL_OPERATIONS_TOKEN?.trim()),
  );
}

function internalTokenInformationalCheck() {
  return {
    ...internalTokenCheck(),
    level: internalTokenCheck().ok ? "ok" : "optional",
    ok: true,
  };
}

function check(name, test) {
  try {
    return { level: "missing", name, ok: Boolean(test()) };
  } catch (error) {
    return {
      level: error instanceof Error ? error.message : "invalid",
      name,
      ok: false,
    };
  }
}

function formatStatus(check) {
  if (check.ok && check.level !== "optional") return "ok";

  return check.level;
}
