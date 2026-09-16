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
