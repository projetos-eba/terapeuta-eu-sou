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

type StripeCustomerRow = {
  stripe_customer_id: string;
};

const runtime = getPaymentsRuntime("stripe-create-billing-portal");

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
    const customers = await client.get<StripeCustomerRow[]>(
      `/rest/v1/stripe_customers?select=stripe_customer_id&therapist_profile_id=eq.${encodeURIComponent(
        therapist.id,
      )}&role=eq.therapist&environment=eq.${encodeURIComponent(config.environment)}&limit=1`,
    );

    if (!customers[0]) {
      throw new DomainError(
        "stripe_customer_missing",
        404,
        "Assinatura ainda nao encontrada.",
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customers[0].stripe_customer_id,
      return_url: `${config.siteUrl}/pro/plano`,
    });

    return success({ url: portal.url });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
