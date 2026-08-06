import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import { createIdempotencyKey } from "../_shared/payments/idempotency.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import { getStripeSubscriptionScheduleId } from "../_shared/payments/stripe-subscription.ts";

type SubscriptionRow = {
  id: string;
  plan_code: "premium" | "premium_plus";
  stripe_subscription_id: string;
};

const runtime = getPaymentsRuntime("stripe-cancel-therapist-subscription");

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
      { allowBlockedStatus: true },
    );
    const [localSubscription] = await client.get<SubscriptionRow[]>(
      `/rest/v1/therapist_subscriptions?select=id,plan_code,stripe_subscription_id&therapist_profile_id=eq.${encodeURIComponent(
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

    const subscriptionBeforeCancel = await stripe.subscriptions.retrieve(
      localSubscription.stripe_subscription_id,
    );
    const scheduleId = getStripeSubscriptionScheduleId(
      subscriptionBeforeCancel,
    );

    if (scheduleId) {
      await stripe.subscriptionSchedules.release(
        scheduleId,
        { preserve_cancel_date: false },
        {
          idempotencyKey: createIdempotencyKey([
            "tes",
            config.stripeMode,
            "subscription_cancel_release_schedule",
            therapist.id,
            localSubscription.stripe_subscription_id,
            scheduleId,
          ]),
        },
      );
    }

    const idempotencyKey = createIdempotencyKey([
      "tes",
      config.stripeMode,
      "subscription_cancel_period_end",
      therapist.id,
      localSubscription.stripe_subscription_id,
    ]);
    const subscription = await stripe.subscriptions.update(
      localSubscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
        metadata: {
          cancel_policy: "cancel_at_period_end",
          plan_code: localSubscription.plan_code,
          system: "tes",
          tes_therapist_id: therapist.id,
          user_id: user.id,
        },
        proration_behavior: "none",
      },
      { idempotencyKey },
    );

    await client.post(
      "/rest/v1/therapist_subscription_events",
      {
        event_type: "cancellation_scheduled",
        metadata: {
          cancelAtPeriodEnd: true,
          currentPlan: localSubscription.plan_code,
          releasedStripeScheduleId: scheduleId,
        },
        therapist_profile_id: therapist.id,
        therapist_subscription_id: localSubscription.id,
      },
      "return=minimal",
    );

    const currentPeriodEnd = numberOrNull(
      (subscription as unknown as Record<string, unknown>).current_period_end,
    );

    return success({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd:
        currentPeriodEnd === null
          ? null
          : new Date(currentPeriodEnd * 1000).toISOString(),
      stripeSubscriptionId: subscription.id,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

export {};
