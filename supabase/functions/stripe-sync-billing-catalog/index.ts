import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireInternalOperationsAccess,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type BillingPriceRow = {
  billing_plans: {
    code: "free" | "premium" | "premium_plus";
    name: string;
  } | null;
  id: string;
  interval: "month" | "year" | null;
  stripe_lookup_key: string | null;
  unit_amount_cents: number;
};

const runtime = getPaymentsRuntime("stripe-sync-billing-catalog");

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
    await requireOperationsAccess(client, request);

    const stripe = createStripeClient(config.stripeApiKey);
    const rows = await client.get<BillingPriceRow[]>(
      "/rest/v1/billing_plan_prices?select=id,unit_amount_cents,interval,stripe_lookup_key,billing_plans!inner(code,name)&unit_amount_cents=gt.0&is_active=eq.true",
    );
    const synced = [];

    for (const row of rows) {
      if (!row.billing_plans || !row.stripe_lookup_key || !row.interval)
        continue;

      const existingPrices = await stripe.prices.list({
        active: true,
        limit: 1,
        lookup_keys: [row.stripe_lookup_key],
      });
      let price = existingPrices.data[0];
      let productId = typeof price?.product === "string" ? price.product : null;

      if (!price) {
        const product = await findOrCreateProduct(stripe, {
          environment: config.environment,
          name: row.billing_plans.name,
          planCode: row.billing_plans.code,
          stripeMode: config.stripeMode,
        });
        productId = product.id;
        price = await stripe.prices.create({
          currency: "brl",
          lookup_key: row.stripe_lookup_key,
          metadata: {
            entity: "therapist_plan_price",
            environment: config.environment,
            stripe_mode: config.stripeMode,
            plan_code: row.billing_plans.code,
            system: "tes",
          },
          product: product.id,
          recurring: { interval: row.interval },
          unit_amount: row.unit_amount_cents,
        });
      }

      if (
        price.currency !== "brl" ||
        price.unit_amount !== row.unit_amount_cents ||
        price.recurring?.interval !== row.interval ||
        (price.livemode ? "live" : "test") !== config.stripeMode
      ) {
        throw new DomainError(
          "stripe_catalog_mismatch",
          409,
          `Preco Stripe divergente para ${row.billing_plans.code}.`,
        );
      }

      await client.patch(
        `/rest/v1/billing_plan_prices?id=eq.${encodeURIComponent(row.id)}`,
        {
          stripe_livemode: price.livemode,
          stripe_price_id: price.id,
          stripe_product_id: productId,
          environment: config.environment,
          updated_at: new Date().toISOString(),
        },
        "return=minimal",
      );
      synced.push({
        planCode: row.billing_plans.code,
        priceId: price.id,
        productId,
        reused: Boolean(existingPrices.data[0]),
      });
    }

    return success({ synced });
  } catch (error) {
    return failure(error, requestId);
  }
});

async function findOrCreateProduct(
  stripe: ReturnType<typeof createStripeClient>,
  input: {
    environment: string;
    name: string;
    planCode: string;
    stripeMode: string;
  },
) {
  const products = await stripe.products.search({
    query: `active:'true' AND metadata['system']:'tes' AND metadata['entity']:'therapist_plan' AND metadata['plan_code']:'${input.planCode}'`,
  });

  if (products.data[0]) return products.data[0];

  return stripe.products.create({
    metadata: {
      entity: "therapist_plan",
      environment: input.environment,
      plan_code: input.planCode,
      stripe_mode: input.stripeMode,
      system: "tes",
    },
    name: `TES ${input.name}`,
  });
}

async function requireOperationsAccess(
  client: SupabaseRestClient,
  request: Request,
) {
  if (request.headers.has("x-tes-internal-operations-token")) {
    await requireInternalOperationsAccess(
      runtime.env.get("PAYMENTS_INTERNAL_OPERATIONS_TOKEN"),
      request,
    );
    return;
  }

  const user = await requireUser(client, request);

  if (user.role !== "admin") {
    throw new DomainError(
      "admin_required",
      403,
      "Acesso administrativo necessario.",
    );
  }
}

export {};
