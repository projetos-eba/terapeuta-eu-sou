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
import { getStripeSubscriptionPeriod } from "../_shared/payments/stripe-subscription.ts";

type Body = {
  targetPlan?: string;
};

type SubscriptionRow = {
  id: string;
  metadata: Record<string, unknown>;
  plan_code: "premium" | "premium_plus";
  stripe_subscription_id: string;
  updated_at: string;
};

type BillingPriceRow = {
  stripe_price_id: string | null;
};

const planRank = {
  premium: 1,
  premium_plus: 2,
} as const;

const runtime = getPaymentsRuntime("stripe-change-therapist-subscription");

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
    const targetPlan = normalizePaidPlan(body.targetPlan);
    const [localSubscription] = await client.get<SubscriptionRow[]>(
      `/rest/v1/therapist_subscriptions?select=id,plan_code,stripe_subscription_id,metadata,updated_at&therapist_profile_id=eq.${encodeURIComponent(
        therapist.id,
      )}&status=in.(active,trialing,past_due)&order=created_at.desc&limit=1`,
    );

    if (!localSubscription) {
      throw new DomainError(
        "active_subscription_not_found",
        404,
        "Assinatura ativa nao encontrada.",
      );
    }

    if (localSubscription.plan_code === targetPlan) {
      throw new DomainError(
        "same_plan",
        409,
        "A assinatura ja esta nesse plano.",
      );
    }

    const [targetPrice] = await client.get<BillingPriceRow[]>(
      `/rest/v1/billing_plan_prices?select=stripe_price_id,billing_plans!inner(code)&billing_plans.code=eq.${targetPlan}&is_active=eq.true&limit=1`,
    );

    if (!targetPrice?.stripe_price_id) {
      throw new DomainError(
        "stripe_price_missing",
        409,
        "Catalogo Stripe ainda nao sincronizado.",
      );
    }

    const subscription = await stripe.subscriptions.retrieve(
      localSubscription.stripe_subscription_id,
    );
    const item = subscription.items.data[0];

    if (!item) {
      throw new DomainError(
        "stripe_subscription_item_missing",
        409,
        "Assinatura Stripe sem item de preco.",
      );
    }

    const isUpgrade =
      planRank[targetPlan] > planRank[localSubscription.plan_code];
    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      isUpgrade ? "subscription_upgrade" : "subscription_downgrade",
      therapist.id,
      targetPlan,
      subscription.id,
      localSubscription.updated_at,
    ]);

    if (isUpgrade) {
      const updated = await stripe.subscriptions.update(
        subscription.id,
        {
          items: [{ id: item.id, price: targetPrice.stripe_price_id }],
          metadata: {
            plan_code: targetPlan,
            system: "tes",
            tes_therapist_id: therapist.id,
            user_id: user.id,
          },
          payment_behavior: "pending_if_incomplete",
          proration_behavior: "always_invoice",
        },
        { idempotencyKey },
      );

      return success({
        change: "upgrade_immediate_prorated",
        stripeSubscriptionId: updated.id,
      });
    }

    const { currentPeriodEnd, currentPeriodStart } =
      getStripeSubscriptionPeriod(
        subscription as unknown as Record<string, unknown>,
      );

    if (currentPeriodStart === null || currentPeriodEnd === null) {
      throw new DomainError(
        "stripe_subscription_period_missing",
        409,
        "Assinatura Stripe sem periodo vigente.",
      );
    }

    const effectiveAt = new Date(currentPeriodEnd * 1000).toISOString();
    if (
      localSubscription.metadata?.scheduled_plan_code === targetPlan &&
      typeof localSubscription.metadata?.stripe_schedule_id === "string"
    ) {
      return success({
        change: "downgrade_at_period_end",
        effectiveAt:
          typeof localSubscription.metadata.scheduled_plan_effective_at ===
          "string"
            ? localSubscription.metadata.scheduled_plan_effective_at
            : effectiveAt,
        stripeScheduleId: localSubscription.metadata.stripe_schedule_id,
      });
    }

    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        plan_code: localSubscription.plan_code,
        scheduled_plan_code: targetPlan,
        scheduled_plan_effective_at: effectiveAt,
        system: "tes",
        tes_therapist_id: therapist.id,
        user_id: user.id,
      },
      proration_behavior: "none",
    });

    const schedule = await stripe.subscriptionSchedules.create(
      { from_subscription: subscription.id },
      { idempotencyKey },
    );

    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      metadata: {
        plan_code: targetPlan,
        system: "tes",
        tes_therapist_id: therapist.id,
        user_id: user.id,
      },
      phases: [
        {
          end_date: currentPeriodEnd,
          items: [
            {
              price: item.price.id,
              quantity: item.quantity ?? 1,
            },
          ],
          start_date: currentPeriodStart,
        },
        {
          items: [
            {
              price: targetPrice.stripe_price_id,
              quantity: item.quantity ?? 1,
            },
          ],
          metadata: {
            plan_code: targetPlan,
            system: "tes",
            tes_therapist_id: therapist.id,
            user_id: user.id,
          },
          proration_behavior: "none",
          start_date: currentPeriodEnd,
        },
      ],
    });

    const scheduledMetadata = {
      ...localSubscription.metadata,
      scheduled_plan_code: targetPlan,
      scheduled_plan_effective_at: effectiveAt,
      stripe_schedule_id: schedule.id,
    };

    await client.patch(
      `/rest/v1/therapist_subscriptions?id=eq.${encodeURIComponent(localSubscription.id)}`,
      { metadata: scheduledMetadata },
      "return=minimal",
    );

    await client.post(
      "/rest/v1/therapist_subscription_events",
      {
        event_type: "downgrade_scheduled",
        metadata: {
          currentPlan: localSubscription.plan_code,
          stripeScheduleId: schedule.id,
          targetPlan,
        },
        therapist_profile_id: therapist.id,
        therapist_subscription_id: localSubscription.id,
      },
      "return=minimal",
    );

    return success({
      change: "downgrade_at_period_end",
      effectiveAt,
      stripeScheduleId: schedule.id,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

function normalizePaidPlan(value: unknown): "premium" | "premium_plus" {
  if (value === "premium" || value === "premium_plus") return value;
  throw new DomainError("invalid_plan", 422, "Escolha um plano pago valido.");
}

export {};
