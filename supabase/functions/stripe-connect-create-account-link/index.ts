import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

const runtime = getPaymentsRuntime("stripe-connect-create-account-link");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Metodo nao permitido.");
    }

    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const stripe = createStripeClient(config.stripeApiKey);
    const { profile: therapist } = await requireTherapist(client, request);
    const rows = await client.get<Array<{ stripe_account_id: string }>>(
      `/rest/v1/therapist_connect_accounts?select=stripe_account_id&therapist_profile_id=eq.${encodeURIComponent(
        therapist.id,
      )}&is_current=eq.true&limit=1`,
    );

    if (!rows[0]) {
      throw new DomainError(
        "connect_account_missing",
        404,
        "Crie a conta de repasse primeiro.",
      );
    }

    const link = await stripe.accountLinks.create({
      account: rows[0].stripe_account_id,
      refresh_url: `${config.siteUrl}/terapeuta/financeiro?connect=refresh`,
      return_url: `${config.siteUrl}/terapeuta/financeiro?connect=return`,
      type: "account_onboarding",
    });

    await client.patch(
      `/rest/v1/therapist_connect_accounts?stripe_account_id=eq.${encodeURIComponent(
        rows[0].stripe_account_id,
      )}&is_current=eq.true`,
      { onboarding_status: "onboarding_started" },
      "return=minimal",
    );

    return success({ url: link.url });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
