export type CheckoutFinancialSnapshot = {
  chargedAmountCents: number;
  currency: string | null;
  discountAmountCents: number;
  metadata: Record<string, unknown>;
  originalAmountCents: number;
};

export function extractCheckoutFinancialSnapshot(
  session: Record<string, unknown>,
): CheckoutFinancialSnapshot | null {
  const chargedAmountCents = numberOrNull(session.amount_total);
  if (chargedAmountCents === null || chargedAmountCents < 0) return null;

  const totalDetails = asRecord(session.total_details);
  const originalAmountCents = numberOrNull(session.amount_subtotal) ??
    chargedAmountCents;
  const discountAmountCents = Math.max(
    numberOrNull(totalDetails.amount_discount) ?? 0,
    0,
  );
  const discounts = Array.isArray(session.discounts)
    ? session.discounts.length
    : Array.isArray(asRecord(totalDetails.breakdown).discounts)
    ? (asRecord(totalDetails.breakdown).discounts as unknown[]).length
    : discountAmountCents > 0
    ? 1
    : 0;

  return {
    chargedAmountCents,
    currency: stringOrNull(session.currency)?.toUpperCase() ?? null,
    discountAmountCents,
    metadata: {
      source: "stripe_checkout_session",
      original_amount_cents: originalAmountCents,
      charged_amount_cents: chargedAmountCents,
      discount_amount_cents: discountAmountCents,
      discount_count: discounts,
      currency: stringOrNull(session.currency)?.toUpperCase() ?? null,
    },
    originalAmountCents: Math.max(originalAmountCents, 0),
  };
}

export function createPaymentIntentFinancialSnapshot(input: {
  amountReceivedCents: number | null;
  currency?: string | null;
  originalAmountCents: number;
}): CheckoutFinancialSnapshot | null {
  if (
    input.amountReceivedCents === null ||
    !Number.isInteger(input.amountReceivedCents) ||
    input.amountReceivedCents < 0
  ) {
    return null;
  }

  const discountAmountCents = Math.max(
    input.originalAmountCents - input.amountReceivedCents,
    0,
  );

  return {
    chargedAmountCents: input.amountReceivedCents,
    currency: input.currency?.toUpperCase() ?? null,
    discountAmountCents,
    metadata: {
      source: "stripe_payment_intent",
      original_amount_cents: input.originalAmountCents,
      charged_amount_cents: input.amountReceivedCents,
      discount_amount_cents: discountAmountCents,
      discount_count: discountAmountCents > 0 ? 1 : 0,
      currency: input.currency?.toUpperCase() ?? null,
    },
    originalAmountCents: input.originalAmountCents,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
