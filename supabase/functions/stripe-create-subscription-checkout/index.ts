import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import { createIdempotencyKey } from "../_shared/payments/idempotency.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Body = {
  plan?: string;
};

type BillingPriceRow = {
  billing_plans: { code: string; name: string } | null;
  id: string;
  stripe_price_id: string | null;
  unit_amount_cents: number;
};

type StripeCustomerRow = {
  id: string;
  stripe_customer_id: string;
};

const runtime = getPaymentsRuntime("stripe-create-subscription-checkout");

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
    const { profile: therapist, user } = await requireTherapist(
      client,
      request,
    );
    const body = await parseJsonBody<Body>(request);
    const plan = normalizePaidPlan(body.plan);
    const price = await getBillingPrice(client, plan);

    if (!price.stripe_price_id) {
      throw new DomainError(
        "stripe_price_missing",
        409,
        "Catalogo Stripe ainda nao sincronizado.",
      );
    }

    const customer = await getOrCreateTherapistCustomer({
      client,
      emailUserId: user.id,
      environment: config.environment,
      stripe,
      therapist,
    });

    const successUrl = `${config.siteUrl}/terapeuta/checkout?plan=${plan}&checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${config.siteUrl}/terapeuta/checkout?plan=${plan}&checkout=canceled`;
    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      "subscription_checkout",
      therapist.id,
      plan,
    ]);

    const params = {
      cancel_url: cancelUrl,
      client_reference_id: therapist.id,
      integration_identifier: `tes_sub_${randomLetters(8)}`,
      customer: customer.stripe_customer_id,
      line_items: [{ price: price.stripe_price_id, quantity: 1 }],
      metadata: {
        environment: config.environment,
        plan_code: plan,
        stripe_mode: config.stripeMode,
        system: "tes",
        tes_therapist_id: therapist.id,
        user_id: user.id,
      },
      mode: "subscription" as const,
      subscription_data: {
        metadata: {
          environment: config.environment,
          plan_code: plan,
          stripe_mode: config.stripeMode,
          system: "tes",
          tes_therapist_id: therapist.id,
          user_id: user.id,
        },
        proration_behavior: "none" as const,
      },
      success_url: successUrl,
    };
    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey,
    });

    return success({
      checkoutSessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

function normalizePaidPlan(value: unknown): "premium" | "premium_plus" {
  if (value === "premium" || value === "premium_plus") return value;
  throw new DomainError("invalid_plan", 422, "Escolha um plano pago valido.");
}

async function getBillingPrice(client: SupabaseRestClient, plan: string) {
  const rows = await client.get<BillingPriceRow[]>(
    `/rest/v1/billing_plan_prices?select=id,unit_amount_cents,stripe_price_id,billing_plans!inner(code,name)&billing_plans.code=eq.${plan}&is_active=eq.true&limit=1`,
  );

  if (!rows[0]) {
    throw new DomainError(
      "billing_price_not_found",
      404,
      "Preco do plano nao encontrado.",
    );
  }

  return rows[0];
}

async function getOrCreateTherapistCustomer(input: {
  client: SupabaseRestClient;
  emailUserId: string;
  environment: string;
  stripe: ReturnType<typeof createStripeClient>;
  therapist: { id: string; public_name: string };
}) {
  const existing = await input.client.get<StripeCustomerRow[]>(
    `/rest/v1/stripe_customers?select=id,stripe_customer_id&therapist_profile_id=eq.${encodeURIComponent(
      input.therapist.id,
    )}&role=eq.therapist&environment=eq.${encodeURIComponent(input.environment)}&limit=1`,
  );

  if (existing[0]) return existing[0];

  const profileRows = await input.client.get<Array<{ email: string | null }>>(
    `/rest/v1/profiles?select=email&id=eq.${encodeURIComponent(input.emailUserId)}&limit=1`,
  );
  const customer = await input.stripe.customers.create({
    email: profileRows[0]?.email ?? undefined,
    metadata: {
      environment: input.environment,
      role: "therapist",
      stripe_mode: input.environment,
      system: "tes",
      tes_therapist_id: input.therapist.id,
      user_id: input.emailUserId,
    },
    name: input.therapist.public_name,
  });
  const inserted = await input.client.post<StripeCustomerRow[]>(
    "/rest/v1/stripe_customers?select=id,stripe_customer_id",
    {
      environment: input.environment,
      profile_id: input.emailUserId,
      role: "therapist",
      stripe_customer_id: customer.id,
      therapist_profile_id: input.therapist.id,
      email: profileRows[0]?.email ?? null,
      livemode: customer.livemode,
    },
    "return=representation",
  );

  return inserted[0];
}

function randomLetters(length: number) {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(bytes)
    .map((byte) => letters[byte % letters.length])
    .join("");
}

export {};
