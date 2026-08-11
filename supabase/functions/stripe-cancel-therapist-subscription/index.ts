import { handleOptions } from "../_shared/auth/cors.ts";
import {
  parseJson,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
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
  metadata: Record<string, unknown>;
  plan_code: "premium" | "premium_plus";
  stripe_subscription_id: string;
  updated_at: string;
};

type Body = { action?: "cancel" | "resume" };

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
    const body = (await parseJson<Body>(request)) ?? {};
    const action = normalizeAction(body.action);
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

    const subscriptionBeforeCancel = await stripe.subscriptions.retrieve(
      localSubscription.stripe_subscription_id,
    );

    if (action === "resume") {
      if (!subscriptionBeforeCancel.cancel_at_period_end) {
        return success({
          cancelAtPeriodEnd: false,
          change: "cancellation_reverted",
        });
      }
      const resumed = await stripe.subscriptions.update(
        localSubscription.stripe_subscription_id,
        {
          cancel_at_period_end: false,
          metadata: {
            cancel_policy: "",
            plan_code: localSubscription.plan_code,
            system: "tes",
            tes_therapist_id: therapist.id,
            user_id: user.id,
          },
          proration_behavior: "none",
        },
        {
          idempotencyKey: createIdempotencyKey([
            "tes",
            config.stripeMode,
            "subscription_resume",
            therapist.id,
            localSubscription.stripe_subscription_id,
            localSubscription.updated_at,
          ]),
        },
      );

      await client.patch(
        `/rest/v1/therapist_subscriptions?id=eq.${encodeURIComponent(localSubscription.id)}`,
        {
          cancel_at_period_end: false,
          metadata: clearCancellationPolicy(localSubscription.metadata),
        },
        "return=minimal",
      );

      await client.post(
        "/rest/v1/therapist_subscription_events",
        {
          event_type: "cancellation_reverted",
          metadata: {
            cancelAtPeriodEnd: false,
            currentPlan: localSubscription.plan_code,
          },
          therapist_profile_id: therapist.id,
          therapist_subscription_id: localSubscription.id,
        },
        "return=minimal",
      );

      return success({
        cancelAtPeriodEnd: resumed.cancel_at_period_end,
        change: "cancellation_reverted",
      });
    }
    const scheduleId = getStripeSubscriptionScheduleId(
      subscriptionBeforeCancel,
    );

    if (subscriptionBeforeCancel.cancel_at_period_end && !scheduleId) {
      return success({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: stripePeriodEnd(subscriptionBeforeCancel),
        stripeSubscriptionId: subscriptionBeforeCancel.id,
      });
    }

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
      localSubscription.updated_at,
    ]);
    const subscription = await stripe.subscriptions.update(
      localSubscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
        metadata: {
          cancel_policy: "cancel_at_period_end",
          plan_code: localSubscription.plan_code,
          scheduled_plan_code: "",
          scheduled_plan_effective_at: "",
          stripe_schedule_id: "",
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

    await client.patch(
      `/rest/v1/therapist_subscriptions?id=eq.${encodeURIComponent(localSubscription.id)}`,
      {
        cancel_at_period_end: true,
        current_period_end:
          currentPeriodEnd === null
            ? null
            : new Date(currentPeriodEnd * 1000).toISOString(),
        metadata: clearScheduledChange(localSubscription.metadata),
      },
      "return=minimal",
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

function clearScheduledChange(metadata: Record<string, unknown>) {
  const {
    scheduled_plan_code: _scheduledPlan,
    scheduled_plan_effective_at: _scheduledAt,
    stripe_schedule_id: _scheduleId,
    ...rest
  } = metadata;
  return rest;
}

function clearCancellationPolicy(metadata: Record<string, unknown>) {
  const { cancel_policy: _cancelPolicy, ...rest } = metadata;
  return rest;
}

function stripePeriodEnd(subscription: unknown) {
  const periodEnd = numberOrNull(
    (subscription as Record<string, unknown>).current_period_end,
  );
  return periodEnd === null ? null : new Date(periodEnd * 1000).toISOString();
}

function normalizeAction(value: unknown): "cancel" | "resume" {
  if (value === undefined || value === "cancel") return "cancel";
  if (value === "resume") return "resume";
  throw new DomainError("invalid_action", 422, "Acao invalida.");
}

export {};
