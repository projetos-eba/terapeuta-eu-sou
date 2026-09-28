import { handleOptions } from "../_shared/auth/cors.ts";
import {
  parseJson,
  SupabaseRestClient,
} from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  requireUser,
  success,
} from "../_shared/payments/http.ts";
import { createIdempotencyKey } from "../_shared/payments/idempotency.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import {
  getStripeSubscriptionPeriod,
  getStripeSubscriptionScheduleId,
} from "../_shared/payments/stripe-subscription.ts";

type Body = {
  reason?: string;
  requestId?: string;
  subscriptionId?: string;
};

type SubscriptionRow = {
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  plan_code: "premium" | "premium_plus";
  status: "active" | "past_due" | "trialing";
  stripe_subscription_id: string;
  therapist_profile_id: string;
  updated_at: string;
};

type TherapistProfileRow = {
  user_id: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const runtime = getPaymentsRuntime("admin-cancel-therapist-subscription");

runtime.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const correlationId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      throw new DomainError("method_not_allowed", 405, "Método não permitido.");
    }

    const config = getPaymentsConfig(runtime);
    const client = new SupabaseRestClient(
      config.supabaseUrl,
      config.serviceRoleKey,
    );
    const actor = await requireUser(client, request);
    if (actor.role !== "admin") {
      throw new DomainError(
        "admin_permission_required",
        403,
        "Ação não permitida.",
      );
    }

    const body = (await parseJson<Body>(request)) ?? {};
    const input = normalizeInput(body);
    const [localSubscription] = await client.get<SubscriptionRow[]>(
      `/rest/v1/therapist_subscriptions?select=id,therapist_profile_id,plan_code,status,stripe_subscription_id,current_period_end,cancel_at_period_end,metadata,updated_at&id=eq.${encodeURIComponent(
        input.subscriptionId,
      )}&status=in.(active,trialing,past_due)&limit=1`,
    );

    if (!localSubscription) {
      throw new DomainError(
        "subscription_not_cancellable",
        409,
        "A assinatura não pode ser cancelada nesta situação.",
      );
    }

    const [therapist] = await client.get<TherapistProfileRow[]>(
      `/rest/v1/therapist_profiles?select=user_id&id=eq.${encodeURIComponent(
        localSubscription.therapist_profile_id,
      )}&limit=1`,
    );
    if (!therapist?.user_id) {
      throw new DomainError(
        "subscription_profile_not_found",
        409,
        "Não foi possível preparar esta assinatura para cancelamento.",
      );
    }

    const stripe = createStripeClient(config.stripeApiKey);
    const before = await stripe.subscriptions.retrieve(
      localSubscription.stripe_subscription_id,
    );
    const scheduleId = getStripeSubscriptionScheduleId(before);
    let subscription = before;

    if (!before.cancel_at_period_end || scheduleId) {
      if (scheduleId) {
        await stripe.subscriptionSchedules.release(
          scheduleId,
          { preserve_cancel_date: false },
          {
            idempotencyKey: createIdempotencyKey([
              "tes",
              config.stripeMode,
              "admin_subscription_cancel_release_schedule",
              input.subscriptionId,
              scheduleId,
              input.requestId,
            ]),
          },
        );
      }

      subscription = await stripe.subscriptions.update(
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
            tes_therapist_id: localSubscription.therapist_profile_id,
            user_id: therapist.user_id,
          },
          proration_behavior: "none",
        },
        {
          idempotencyKey: createIdempotencyKey([
            "tes",
            config.stripeMode,
            "admin_subscription_cancel_period_end",
            input.subscriptionId,
            localSubscription.updated_at,
            input.requestId,
          ]),
        },
      );
    }

    const { currentPeriodEnd: periodEnd } = getStripeSubscriptionPeriod(
      subscription as unknown as Record<string, unknown>,
    );
    const currentPeriodEnd =
      periodEnd === null
        ? localSubscription.current_period_end
        : toIso(periodEnd);
    const wasScheduled = localSubscription.cancel_at_period_end;

    await client.patch(
      `/rest/v1/therapist_subscriptions?id=eq.${encodeURIComponent(
        localSubscription.id,
      )}`,
      {
        cancel_at_period_end: true,
        current_period_end: currentPeriodEnd,
        metadata: clearScheduledChange(localSubscription.metadata),
      },
      "return=minimal",
    );

    if (!wasScheduled) {
      await client.post(
        "/rest/v1/therapist_subscription_events",
        {
          event_type: "cancellation_scheduled",
          metadata: {
            cancelAtPeriodEnd: true,
            currentPlan: localSubscription.plan_code,
            releasedSchedule: Boolean(scheduleId),
          },
          therapist_profile_id: localSubscription.therapist_profile_id,
          therapist_subscription_id: localSubscription.id,
        },
        "return=minimal",
      );
    }

    await client.rpc<string>("/rest/v1/rpc/record_admin_audit_event_v1", {
      p_action: "subscription.cancellation_scheduled",
      p_actor_role: "admin",
      p_actor_user_id: actor.id,
      p_correlation_id: correlationId,
      p_entity_id: localSubscription.id,
      p_entity_type: "therapist_subscription",
      p_next_state: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd,
        plan: localSubscription.plan_code,
        status: localSubscription.status,
      },
      p_permission: "admin.subscriptions.manage",
      p_previous_state: {
        cancelAtPeriodEnd: localSubscription.cancel_at_period_end,
        currentPeriodEnd: localSubscription.current_period_end,
        plan: localSubscription.plan_code,
        status: localSubscription.status,
      },
      p_reason: input.reason,
      p_request_id: input.requestId,
      p_source: "admin_subscription_cancel_command",
    });

    return success({
      cancelAtPeriodEnd: true,
      currentPeriodEnd,
    });
  } catch (error) {
    return failure(error, correlationId);
  }
});

function normalizeInput(body: Body) {
  const subscriptionId = body.subscriptionId?.trim() ?? "";
  const requestId = body.requestId?.trim() ?? "";
  const reason = body.reason?.trim() ?? "";

  if (
    !UUID_PATTERN.test(subscriptionId) ||
    !UUID_PATTERN.test(requestId) ||
    reason.length < 20 ||
    reason.length > 1000
  ) {
    throw new DomainError("invalid_request", 422, "Dados inválidos.");
  }

  return { reason, requestId, subscriptionId };
}

function clearScheduledChange(metadata: Record<string, unknown> | null) {
  const {
    scheduled_plan_code: _scheduledPlan,
    scheduled_plan_effective_at: _scheduledAt,
    stripe_schedule_id: _scheduleId,
    ...rest
  } = metadata ?? {};
  return rest;
}

function toIso(unixSeconds: number | null) {
  return unixSeconds === null
    ? null
    : new Date(unixSeconds * 1000).toISOString();
}

export {};
