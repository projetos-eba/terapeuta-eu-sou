import { handleOptions } from "../_shared/auth/cors.ts";
import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";
import {
  DomainError,
  failure,
  parseJsonBody,
  requireTherapist,
  success,
} from "../_shared/payments/http.ts";
import {
  getPaymentsConfig,
  getPaymentsRuntime,
} from "../_shared/payments/runtime.ts";
import { createStripeClient } from "../_shared/payments/stripe-client.ts";
import {
  getSubscriptionIdentity,
  PLAN_ACTIVE_STATUSES,
  resolveCheckoutStatus,
  syncTherapistSubscriptionFromStripe,
} from "../_shared/payments/subscription-sync.ts";

type Body = {
  sessionId?: string;
};

const runtime = getPaymentsRuntime("stripe-subscription-checkout-status");

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
    const sessionId = normalizeCheckoutSessionId(body.sessionId);
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    const metadata = checkoutSession.metadata ?? {};
    const identity = getSubscriptionIdentity(metadata);

    if (checkoutSession.mode !== "subscription") {
      throw new DomainError(
        "checkout_session_mode_mismatch",
        409,
        "Sessao de checkout invalida para assinatura.",
      );
    }

    if (
      checkoutSession.client_reference_id !== therapist.id ||
      identity.therapistProfileId !== therapist.id ||
      identity.therapistUserId !== user.id ||
      metadata.environment !== config.environment ||
      metadata.system !== "tes"
    ) {
      throw new DomainError(
        "checkout_session_owner_mismatch",
        403,
        "Sessao de checkout nao pertence a este terapeuta.",
      );
    }

    await assertCheckoutCustomerBelongsToTherapist({
      client,
      customerId: stringOrNull(checkoutSession.customer),
      environment: config.environment,
      therapistProfileId: therapist.id,
      userId: user.id,
    });

    const subscription = await resolveSubscription(
      stripe,
      checkoutSession as unknown as Record<string, unknown>,
    );
    const subscriptionStatus = subscription
      ? String(subscription.status ?? "incomplete")
      : null;
    let syncResult = null;

    if (
      subscription &&
      (PLAN_ACTIVE_STATUSES.has(subscriptionStatus ?? "") ||
        subscriptionStatus === "canceled" ||
        checkoutSession.payment_status === "paid")
    ) {
      syncResult = await syncTherapistSubscriptionFromStripe(
        client,
        subscription,
        {
          checkoutSessionId: checkoutSession.id,
          environment: config.environment,
          eventId: `checkout_status_reconcile:${checkoutSession.id}`,
          eventTime: new Date().toISOString(),
          expectedTherapistProfileId: therapist.id,
        },
      );
    }

    const status = resolveCheckoutStatus({
      checkoutPaymentStatus: checkoutSession.payment_status,
      checkoutStatus: checkoutSession.status,
      subscriptionStatus,
    });

    console.log(
      JSON.stringify({
        checkoutSessionId: checkoutSession.id,
        code: "SUBSCRIPTION_CHECKOUT_STATUS_RECONCILED",
        operation: "stripe_subscription_checkout_status",
        plan: syncResult?.plan ?? metadata.plan_code ?? null,
        requestId,
        status,
        stripeSubscriptionId: syncResult?.stripeSubscriptionId ?? null,
        subscriptionStatus,
        therapistId: therapist.id,
      }),
    );

    return success({
      checkoutSessionId: checkoutSession.id,
      plan: syncResult?.localPlan ?? syncResult?.plan ?? null,
      status,
      subscriptionStatus,
    });
  } catch (error) {
    return failure(error, requestId);
  }
});

function normalizeCheckoutSessionId(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^cs_(test|live)_[A-Za-z0-9_]+$/.test(value)
  ) {
    throw new DomainError(
      "invalid_checkout_session_id",
      422,
      "Sessao de checkout invalida.",
    );
  }

  return value;
}

async function resolveSubscription(
  stripe: ReturnType<typeof createStripeClient>,
  checkoutSession: Record<string, unknown>,
) {
  const value = checkoutSession.subscription;

  if (!value) return null;
  if (typeof value === "string") {
    return (await stripe.subscriptions.retrieve(value)) as unknown as Record<
      string,
      unknown
    >;
  }

  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function assertCheckoutCustomerBelongsToTherapist(input: {
  client: SupabaseRestClient;
  customerId: string | null;
  environment: string;
  therapistProfileId: string;
  userId: string;
}) {
  if (!input.customerId) {
    throw new DomainError(
      "checkout_customer_missing",
      409,
      "Customer Stripe ausente na sessao de checkout.",
    );
  }

  const [customer] = await input.client.get<
    Array<{
      profile_id: string;
      role: string;
      therapist_profile_id: string | null;
    }>
  >(
    `/rest/v1/stripe_customers?select=profile_id,role,therapist_profile_id&stripe_customer_id=eq.${encodeURIComponent(
      input.customerId,
    )}&environment=eq.${encodeURIComponent(input.environment)}&limit=1`,
  );

  if (
    !customer ||
    customer.role !== "therapist" ||
    customer.profile_id !== input.userId ||
    customer.therapist_profile_id !== input.therapistProfileId
  ) {
    throw new DomainError(
      "checkout_customer_mismatch",
      403,
      "Customer Stripe nao pertence a este terapeuta.",
    );
  }
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export {};
