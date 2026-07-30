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

const runtime = getPaymentsRuntime("stripe-connect-create-login-link");

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
    const rows = await client.get<
      Array<{
        onboarding_status: string;
        stripe_account_id: string;
        stripe_transfers_status: string;
      }>
    >(
      `/rest/v1/therapist_connect_accounts?select=stripe_account_id,onboarding_status,stripe_transfers_status&therapist_profile_id=eq.${encodeURIComponent(
        therapist.id,
      )}&limit=1`,
    );

    if (!rows[0]) {
      throw new DomainError(
        "connect_account_missing",
        404,
        "Conta de repasse nao encontrada.",
      );
    }

    if (
      rows[0].onboarding_status !== "ready" ||
      rows[0].stripe_transfers_status !== "active"
    ) {
      throw new DomainError(
        "connect_account_not_ready",
        409,
        "Conclua o cadastro da conta antes de gerenciar na Stripe.",
      );
    }

    const link = await stripe.accounts.createLoginLink(
      rows[0].stripe_account_id,
    );

    return success({ url: link.url });
  } catch (error) {
    return failure(error, requestId);
  }
});

export {};
