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
  requestId?: string;
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
    const checkoutRequestId = normalizeRequestId(body.requestId);
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
    const existingOpenSession = await findReusableOpenSubscriptionCheckout({
      customerId: customer.stripe_customer_id,
      environment: config.environment,
      plan,
      stripe,
      therapistId: therapist.id,
    });

    if (existingOpenSession?.url) {
      return success({
        checkoutSessionId: existingOpenSession.id,
        reused: true,
        url: existingOpenSession.url,
      });
    }

    await assertNoActivePaidSubscription(client, therapist.id);

    const successUrl = `${config.siteUrl}/terapeuta/checkout?plan=${plan}&checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${config.siteUrl}/terapeuta/checkout?plan=${plan}&checkout=canceled`;
    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      "subscription_checkout_v2",
      therapist.id,
      plan,
      checkoutRequestId,
    ]);
    const integrationIdentifier = createIdempotencyKey([
      "tes_sub",
      therapist.id,
      plan,
      checkoutRequestId,
    ])
      .replace(/:/g, "_")
      .slice(0, 64);

    const params = {
      cancel_url: cancelUrl,
      client_reference_id: therapist.id,
      integration_identifier: integrationIdentifier,
      customer: customer.stripe_customer_id,
      line_items: [{ price: price.stripe_price_id, quantity: 1 }],
      metadata: {
        checkout_request_id: checkoutRequestId,
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
          checkout_request_id: checkoutRequestId,
          environment: config.environment,
          plan_code: plan,
          stripe_mode: config.stripeMode,
          system: "tes",
          tes_therapist_id: therapist.id,
          user_id: user.id,
        },
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

function normalizeRequestId(value: unknown) {
  if (typeof value !== "string" || !isUuid(value)) {
    throw new DomainError(
      "invalid_request_id",
      422,
      "Envie um identificador valido para a tentativa de checkout.",
    );
  }

  return value;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
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

async function findReusableOpenSubscriptionCheckout(input: {
  customerId: string;
  environment: string;
  plan: "premium" | "premium_plus";
  stripe: ReturnType<typeof createStripeClient>;
  therapistId: string;
}) {
  const sessions = await input.stripe.checkout.sessions.list({
    customer: input.customerId,
    limit: 10,
    status: "open",
  });
  const minimumUsableExpiry = Math.floor(Date.now() / 1000) + 120;

  return sessions.data.find((session) => {
    const metadata = session.metadata ?? {};

    return (
      session.mode === "subscription" &&
      Boolean(session.url) &&
      (session.expires_at ?? 0) > minimumUsableExpiry &&
      metadata.environment === input.environment &&
      metadata.plan_code === input.plan &&
      metadata.system === "tes" &&
      metadata.tes_therapist_id === input.therapistId
    );
  });
}

async function assertNoActivePaidSubscription(
  client: SupabaseRestClient,
  therapistProfileId: string,
) {
  const rows = await client.get<Array<{ id: string }>>(
    `/rest/v1/therapist_subscriptions?select=id&therapist_profile_id=eq.${encodeURIComponent(
      therapistProfileId,
    )}&status=in.(trialing,active,past_due,unpaid,incomplete)&limit=1`,
  );

  if (rows[0]) {
    throw new DomainError(
      "active_subscription_exists",
      409,
      "Ja existe uma assinatura paga em andamento para este perfil.",
    );
  }
}

export {};
