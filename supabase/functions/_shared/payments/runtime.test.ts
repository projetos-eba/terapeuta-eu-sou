import { getPaymentsConfig } from "./runtime.ts";

Deno.test(
  "keeps the V10 session flow disabled unless explicitly enabled",
  () => {
    const disabled = getPaymentsConfig(mockRuntime({}));
    const enabled = getPaymentsConfig(
      mockRuntime({
        TES_SESSION_FINANCIAL_FLOW_V10_ENABLED: "true",
      }),
    );

    if (disabled.sessionFinancialFlowV10Enabled) {
      throw new Error("v10_must_default_to_disabled");
    }
    if (!enabled.sessionFinancialFlowV10Enabled) {
      throw new Error("v10_explicit_enablement_ignored");
    }
  },
);

Deno.test("rejects an ambiguous V10 session flow flag", () => {
  try {
    getPaymentsConfig(
      mockRuntime({
        TES_SESSION_FINANCIAL_FLOW_V10_ENABLED: "1",
      }),
    );
    throw new Error("invalid_flag_was_accepted");
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message === "invalid_flag_was_accepted"
    ) {
      throw error;
    }
  }
});

function mockRuntime(overrides: Record<string, string | undefined>) {
  const values = {
    EMAIL_PUBLIC_SITE_URL: "http://localhost:3000",
    STRIPE_SECRET_KEY: "sk_test_local",
    SUPABASE_SERVICE_ROLE_KEY: "header.payload.signature",
    SUPABASE_URL: "http://127.0.0.1:54321",
    ...overrides,
  };

  return {
    env: {
      get(name: string) {
        return values[name as keyof typeof values];
      },
    },
    serve() {
      return undefined;
    },
  };
}
