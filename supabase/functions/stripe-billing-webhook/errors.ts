import { DomainError } from "../_shared/payments/http.ts";

const STRIPE_SIGNATURE_VERIFICATION_ERROR = "StripeSignatureVerificationError";

export function normalizeStripeBillingWebhookError(error: unknown) {
  if (isStripeSignatureVerificationError(error)) {
    return new DomainError(
      "stripe_webhook_signature_invalid",
      400,
      "Assinatura do webhook Stripe invalida.",
    );
  }

  return error;
}

function isStripeSignatureVerificationError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    constructor?: { name?: unknown };
    type?: unknown;
  };

  return (
    candidate.type === STRIPE_SIGNATURE_VERIFICATION_ERROR ||
    candidate.constructor?.name === STRIPE_SIGNATURE_VERIFICATION_ERROR
  );
}
