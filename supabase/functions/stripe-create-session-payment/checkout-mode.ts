import { DomainError } from "../_shared/payments/http.ts";

export type ReservationCheckoutMode = "initial_hold" | "payment_retry";

export function resolveReservationCheckoutMode(input: {
  bookingStatus: string;
  replacedAttemptKind?: string | null;
  requestedAttemptKind?: string | null;
}): ReservationCheckoutMode {
  const replacedMode = input.replacedAttemptKind
    ? requireReservationCheckoutMode(input.replacedAttemptKind)
    : null;
  const requestedMode = input.requestedAttemptKind
    ? requireReservationCheckoutMode(input.requestedAttemptKind)
    : null;

  if (replacedMode && requestedMode && replacedMode !== requestedMode) {
    throw checkoutModeConflict();
  }
  if (replacedMode) return replacedMode;
  if (requestedMode) return requestedMode;

  return input.bookingStatus === "cancelled_by_payment"
    ? "payment_retry"
    : "initial_hold";
}

export function requiresLegacyRetryPreflight(input: {
  mode: ReservationCheckoutMode;
  paymentFlowVersion?: string | null;
}) {
  return input.mode === "payment_retry" && input.paymentFlowVersion !== "v10";
}

export function resolveSessionCaptureMethod(input: {
  mode: ReservationCheckoutMode;
  paymentFlowVersion?: string | null;
}): "manual" | undefined {
  // A retry is created only after the original hold released the slot. Stripe
  // must authorize first so the signed webhook can atomically reclaim the
  // therapist and patient calendars before capturing any money.
  if (input.mode === "payment_retry") return "manual";

  // Preserve the established V10 initial-checkout behavior. Legacy V9 keeps
  // its existing manual-capture contract for every checkout mode.
  return input.paymentFlowVersion === "v10" ? undefined : "manual";
}

export function shouldReusePersistedPaymentRetryCheckout(input: {
  checkoutSessionId?: string | null;
  mode: ReservationCheckoutMode;
  retryReason?: string | null;
}) {
  return (
    input.mode === "payment_retry" &&
    input.retryReason === "checkout_already_created" &&
    Boolean(input.checkoutSessionId)
  );
}

function requireReservationCheckoutMode(
  value: string,
): ReservationCheckoutMode {
  if (value === "initial_hold" || value === "payment_retry") return value;
  throw checkoutModeConflict();
}

function checkoutModeConflict() {
  return new DomainError(
    "checkout_replacement_forbidden",
    409,
    "Este pagamento não pode mais ser atualizado.",
  );
}
