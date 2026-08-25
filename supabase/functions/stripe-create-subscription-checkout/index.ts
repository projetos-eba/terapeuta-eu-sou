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
import { getPaymentsConfig, getPaymentsRuntime } from "../_shared/payments/runtime.ts";
import { getLiveSmokeCheckoutDiscounts } from "../_shared/payments/live-smoke.ts";
import {
  checkoutAmounts,
  mapPromotionStripeError,
  resolvePromotionCode,
} from "../_shared/payments/promotion-codes.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";

type Body = {
  checkoutUiMode?: string;
  plan?: string;
  promotionCode?: string | null;
  replaceCheckoutSessionId?: string | null;
  requestId?: string;
};

type BillingPriceRow = {
  billing_plans: { code: string; name: string } | null;
  id: string;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
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
    const checkoutUiMode = normalizeCheckoutUiMode(body.checkoutUiMode);
    const replaceCheckoutSessionId = optionalCheckoutSessionId(
      body.replaceCheckoutSessionId,
    );
    const price = await getBillingPrice(client, plan);
    const liveSmokeDiscounts = getLiveSmokeCheckoutDiscounts({
      couponId: runtime.env.get("PAYMENTS_LIVE_SMOKE_COUPON_ID"),
      enabledValue: runtime.env.get("PAYMENTS_LIVE_SMOKE_ENABLED"),
      stripeMode: config.stripeMode,
      therapistProfileId: therapist.id,
      therapistProfileIdAllowlist: runtime.env.get(
        "PAYMENTS_LIVE_SMOKE_THERAPIST_PROFILE_ID",
      ),
    });
    const liveSmokeCoupon = liveSmokeDiscounts[0]?.coupon ?? null;

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
    const previousCheckout = replaceCheckoutSessionId
      ? await validateReplacementCheckout({
        checkoutSessionId: replaceCheckoutSessionId,
        customerId: customer.stripe_customer_id,
        environment: config.environment,
        plan,
        stripe,
        stripeMode: config.stripeMode,
        therapistId: therapist.id,
      })
      : null;
    const eligibleProductId = body.promotionCode
      ? await resolveBillingProductId(stripe, price)
      : null;
    const promotion = body.promotionCode
      ? await resolvePromotionCode({
        checkoutScope: "subscription",
        code: body.promotionCode,
        currency: "brl",
        customerId: customer.stripe_customer_id,
        eligibleProductId: eligibleProductId ?? undefined,
        originalAmountCents: price.unit_amount_cents,
        stripe,
      })
      : null;
    const effectiveLiveSmokeDiscounts = promotion ? [] : liveSmokeDiscounts;
    const effectiveLiveSmokeCoupon = promotion ? null : liveSmokeCoupon;
    const existingOpenSession = replaceCheckoutSessionId
      ? null
      : await findReusableOpenSubscriptionCheckout({
        customerId: customer.stripe_customer_id,
        environment: config.environment,
        liveSmokeCoupon: effectiveLiveSmokeCoupon,
        mode: checkoutUiMode,
        plan,
        promotionCodeId: promotion?.promotionCodeId ?? null,
        stripe,
        therapistId: therapist.id,
      });

    if (checkoutUiMode === "hosted" && existingOpenSession?.url) {
      return success({
        ...checkoutAmounts(existingOpenSession),
        checkoutSessionId: existingOpenSession.id,
        checkoutUiMode,
        promotion: promotion?.summary ?? null,
        reused: true,
        url: existingOpenSession.url,
      });
    }

    if (checkoutUiMode === "embedded" && existingOpenSession?.client_secret) {
      return success({
        ...checkoutAmounts(existingOpenSession),
        checkoutSessionId: existingOpenSession.id,
        checkoutUiMode,
        clientSecret: existingOpenSession.client_secret,
        promotion: promotion?.summary ?? null,
        reused: true,
      });
    }

    await assertNoActivePaidSubscription(client, therapist.id);

    const successUrl =
      `${config.siteUrl}/terapeuta/checkout?plan=${plan}&checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      `${config.siteUrl}/terapeuta/checkout?plan=${plan}&checkout=canceled`;
    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      "subscription_checkout_v2",
      checkoutUiMode,
      therapist.id,
      plan,
      checkoutRequestId,
      promotion?.promotionCodeId ?? "no_promotion",
    ]);
    const integrationIdentifier = createIdempotencyKey([
      "tes_sub",
      therapist.id,
      plan,
      checkoutRequestId,
    ])
      .replace(/:/g, "_")
      .slice(0, 64);

    const baseParams = {
      client_reference_id: therapist.id,
      integration_identifier: integrationIdentifier,
      customer: customer.stripe_customer_id,
      line_items: [{ price: price.stripe_price_id, quantity: 1 }],
      metadata: {
        checkout_request_id: checkoutRequestId,
        checkout_ui_mode: checkoutUiMode,
        environment: config.environment,
        ...(effectiveLiveSmokeCoupon
          ? { live_smoke_coupon: effectiveLiveSmokeCoupon }
          : {}),
        ...(promotion ? { tes_promotion_code_id: promotion.promotionCodeId } : {}),
        plan_code: plan,
        ...(replaceCheckoutSessionId
          ? { replaces_checkout_session_id: replaceCheckoutSessionId }
          : {}),
        stripe_mode: config.stripeMode,
        system: "tes",
        therapist_profile_id: therapist.id,
        therapist_user_id: user.id,
        tes_therapist_id: therapist.id,
        user_id: user.id,
      },
      mode: "subscription" as const,
      subscription_data: {
        metadata: {
          checkout_request_id: checkoutRequestId,
          checkout_ui_mode: checkoutUiMode,
          environment: config.environment,
          ...(effectiveLiveSmokeCoupon
            ? { live_smoke_coupon: effectiveLiveSmokeCoupon }
            : {}),
          ...(promotion ? { tes_promotion_code_id: promotion.promotionCodeId } : {}),
          plan_code: plan,
          ...(replaceCheckoutSessionId
            ? { replaces_checkout_session_id: replaceCheckoutSessionId }
            : {}),
          stripe_mode: config.stripeMode,
          system: "tes",
          therapist_profile_id: therapist.id,
          therapist_user_id: user.id,
          tes_therapist_id: therapist.id,
          user_id: user.id,
        },
      },
      locale: "pt-BR" as const,
      ...(promotion
        ? { discounts: [{ promotion_code: promotion.promotionCodeId }] }
        : effectiveLiveSmokeDiscounts.length
        ? { discounts: effectiveLiveSmokeDiscounts }
        : {}),
    };
    const params = checkoutUiMode === "embedded"
      ? {
        ...baseParams,
        return_url:
          `${config.siteUrl}/terapeuta/checkout?plan=${plan}&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        ui_mode: "embedded_page" as const,
      }
      : {
        ...baseParams,
        cancel_url: cancelUrl,
        success_url: successUrl,
      };
    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
    try {
      session = await stripe.checkout.sessions.create(params, {
        idempotencyKey,
      });
    } catch (error) {
      throw mapPromotionStripeError(error) ?? error;
    }
    const amounts = checkoutAmounts(session);

    if (previousCheckout) {
      const expired = await expireCheckoutQuietly(stripe, previousCheckout.id);
      if (!expired) {
        try {
          const previousState = await stripe.checkout.sessions.retrieve(
            previousCheckout.id,
          );
          const openReplacements = await stripe.checkout.sessions.list({
            customer: customer.stripe_customer_id,
            limit: 10,
            status: "open",
          });
          const competingReplacement = openReplacements.data.find(
            (candidate) =>
              candidate.id !== session.id &&
              candidate.metadata?.replaces_checkout_session_id ===
                previousCheckout.id,
          );
          const isIdempotentRetry = previousState.status === "expired" &&
            !competingReplacement;
          if (!isIdempotentRetry) throw new Error("replacement_conflict");
        } catch {
          await expireCheckoutQuietly(stripe, session.id);
          throw new DomainError(
            "checkout_replacement_conflict",
            409,
            "O pagamento foi atualizado em outra tentativa. Tente novamente.",
          );
        }
      }
    }

    console.log(
      JSON.stringify({
        checkoutSessionId: session.id,
        checkoutUiMode,
        code: "SUBSCRIPTION_CHECKOUT_CREATED",
        liveSmokeCouponApplied: Boolean(effectiveLiveSmokeCoupon),
        operation: "stripe_create_subscription_checkout",
        plan,
        requestId,
        therapistId: therapist.id,
      }),
    );

    return success({
      checkoutSessionId: session.id,
      checkoutUiMode,
      clientSecret: session.client_secret ?? null,
      ...amounts,
      promotion: promotion?.summary ?? null,
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

function normalizeCheckoutUiMode(value: unknown): "embedded" | "hosted" {
  if (value === "embedded") return "embedded";
  if (value === "hosted" || value === undefined || value === null) {
    return "hosted";
  }
  throw new DomainError(
    "invalid_checkout_ui_mode",
    422,
    "Modo de checkout invalido.",
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      value,
    );
}

function optionalCheckoutSessionId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !value.startsWith("cs_")) {
    throw new DomainError(
      "invalid_replace_checkout_session_id",
      422,
      "Identificador inválido.",
    );
  }
  return value;
}

async function getBillingPrice(client: SupabaseRestClient, plan: string) {
  const rows = await client.get<BillingPriceRow[]>(
    `/rest/v1/billing_plan_prices?select=id,unit_amount_cents,stripe_price_id,stripe_product_id,billing_plans!inner(code,name)&billing_plans.code=eq.${plan}&is_active=eq.true&limit=1`,
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

async function resolveBillingProductId(
  stripe: ReturnType<typeof createStripeClient>,
  price: BillingPriceRow,
) {
  if (price.stripe_product_id) return price.stripe_product_id;
  if (!price.stripe_price_id) return null;
  const stripePrice = await stripe.prices.retrieve(price.stripe_price_id);
  return typeof stripePrice.product === "string"
    ? stripePrice.product
    : stripePrice.product?.id ?? null;
}

async function getOrCreateTherapistCustomer(input: {
  client: SupabaseRestClient;
  emailUserId: string;
  environment: string;
  stripe: ReturnType<typeof createStripeClient>;
  therapist: { id: string; public_name: string };
}) {
  const existing = await input.client.get<StripeCustomerRow[]>(
    `/rest/v1/stripe_customers?select=id,stripe_customer_id&therapist_profile_id=eq.${
      encodeURIComponent(
        input.therapist.id,
      )
    }&role=eq.therapist&environment=eq.${
      encodeURIComponent(input.environment)
    }&limit=1`,
  );

  if (existing[0]) return existing[0];

  const profileRows = await input.client.get<Array<{ email: string | null }>>(
    `/rest/v1/profiles?select=email&id=eq.${
      encodeURIComponent(input.emailUserId)
    }&limit=1`,
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
  mode: "embedded" | "hosted";
  plan: "premium" | "premium_plus";
  stripe: ReturnType<typeof createStripeClient>;
  therapistId: string;
  liveSmokeCoupon: string | null;
  promotionCodeId: string | null;
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
      (session.expires_at ?? 0) > minimumUsableExpiry &&
      (input.mode === "hosted"
        ? Boolean(session.url)
        : Boolean(session.client_secret)) &&
      metadata.checkout_ui_mode === input.mode &&
      metadata.environment === input.environment &&
      (input.liveSmokeCoupon
        ? metadata.live_smoke_coupon === input.liveSmokeCoupon
        : !metadata.live_smoke_coupon) &&
      (input.promotionCodeId
        ? metadata.tes_promotion_code_id === input.promotionCodeId
        : !metadata.tes_promotion_code_id) &&
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
    `/rest/v1/therapist_subscriptions?select=id&therapist_profile_id=eq.${
      encodeURIComponent(
        therapistProfileId,
      )
    }&status=in.(trialing,active,past_due,unpaid)&limit=1`,
  );

  if (rows[0]) {
    throw new DomainError(
      "active_subscription_exists",
      409,
      "Ja existe uma assinatura paga em andamento para este perfil.",
    );
  }
}

async function validateReplacementCheckout(input: {
  checkoutSessionId: string;
  customerId: string;
  environment: string;
  plan: "premium" | "premium_plus";
  stripeMode: string;
  stripe: ReturnType<typeof createStripeClient>;
  therapistId: string;
}) {
  const checkout = await input.stripe.checkout.sessions.retrieve(
    input.checkoutSessionId,
  );
  const checkoutCustomer = typeof checkout.customer === "string"
    ? checkout.customer
    : checkout.customer?.id ?? null;

  if (
    checkout.status !== "open" ||
    checkout.mode !== "subscription" ||
    checkout.livemode !== (input.stripeMode === "live") ||
    checkoutCustomer !== input.customerId ||
    checkout.client_reference_id !== input.therapistId ||
    checkout.metadata?.environment !== input.environment ||
    checkout.metadata?.stripe_mode !== input.stripeMode ||
    checkout.metadata?.plan_code !== input.plan ||
    checkout.metadata?.system !== "tes" ||
    checkout.metadata?.tes_therapist_id !== input.therapistId
  ) {
    throw new DomainError(
      "checkout_replacement_forbidden",
      409,
      "Este pagamento não pode mais ser atualizado.",
    );
  }

  return checkout;
}

async function expireCheckoutQuietly(
  stripe: ReturnType<typeof createStripeClient>,
  checkoutSessionId: string,
) {
  try {
    await stripe.checkout.sessions.expire(checkoutSessionId);
    return true;
  } catch {
    return false;
  }
}

export {};
