import { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";

export function isPaidTherapistPlan(plan: TherapistPlan) {
  return plan === TherapistPlan.Premium || plan === TherapistPlan.PremiumPlus;
}

export function getTherapistDashboardHref(_plan: TherapistPlan) {
  return routes.therapist.home;
}

export function getTherapistCheckoutHref(plan: TherapistPlan) {
  if (!isPaidTherapistPlan(plan)) return routes.therapist.home;

  return `${routes.public.therapistCheckout}?plan=${plan}`;
}

export function getTherapistPostSignupHref(plan: TherapistPlan) {
  if (!isPaidTherapistPlan(plan)) {
    return `${routes.public.therapistSignIn}?created=1`;
  }

  return `${getTherapistCheckoutHref(plan)}&created=1`;
}

export function getTherapistLoginHref(
  continuation?: string | null,
  options: { created?: boolean } = {},
) {
  const safeContinuation = getSafeTherapistContinuation(continuation);
  const params = new URLSearchParams();

  if (options.created) {
    params.set("created", "1");
  }

  if (safeContinuation) {
    params.set("next", safeContinuation);
  }

  const query = params.toString();

  return query
    ? `${routes.public.therapistSignIn}?${query}`
    : routes.public.therapistSignIn;
}

export function getTherapistLoginRedirect(
  plan: TherapistPlan,
  continuation?: string | null,
) {
  return (
    getSafeTherapistContinuation(continuation) ??
    getTherapistDashboardHref(plan)
  );
}

export function getSafeTherapistContinuation(value?: string | null) {
  if (!value?.startsWith("/")) return null;

  try {
    const url = new URL(value, "http://tes.local");

    if (
      url.origin !== "http://tes.local" ||
      url.pathname !== routes.public.therapistCheckout
    ) {
      return null;
    }

    const plan = url.searchParams.get("plan");

    if (plan !== TherapistPlan.Premium && plan !== TherapistPlan.PremiumPlus) {
      return null;
    }

    const safeSearchParams = new URLSearchParams({ plan });
    const checkoutStatus = url.searchParams.get("checkout");
    const sessionId = url.searchParams.get("session_id");

    if (isAllowedCheckoutReturnStatus(checkoutStatus)) {
      safeSearchParams.set("checkout", checkoutStatus);
    }

    if (sessionId && /^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {
      safeSearchParams.set("session_id", sessionId);
    }

    if (url.searchParams.get("created") === "1") {
      safeSearchParams.set("created", "1");
    }

    return `${routes.public.therapistCheckout}?${safeSearchParams.toString()}`;
  } catch {
    return null;
  }
}

function isAllowedCheckoutReturnStatus(value: string | null) {
  return (
    value === "success" ||
    value === "canceled" ||
    value === "catalog" ||
    value === "configuration" ||
    value === "unauthorized" ||
    value === "unavailable"
  );
}
