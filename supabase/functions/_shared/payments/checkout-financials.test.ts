import {
  createPaymentIntentFinancialSnapshot,
  extractCheckoutFinancialSnapshot,
} from "./checkout-financials.ts";

if (typeof Deno !== "undefined") {
  Deno.test("extracts Stripe Checkout discount totals", () => {
    const snapshot = extractCheckoutFinancialSnapshot({
      amount_subtotal: 20000,
      amount_total: 16000,
      currency: "brl",
      discounts: [{ id: "di_123" }],
      total_details: { amount_discount: 4000 },
    });

    if (!snapshot) throw new Error("snapshot_missing");
    if (snapshot.originalAmountCents !== 20000) {
      throw new Error("original_amount_not_preserved");
    }
    if (snapshot.chargedAmountCents !== 16000) {
      throw new Error("charged_amount_not_extracted");
    }
    if (snapshot.discountAmountCents !== 4000) {
      throw new Error("discount_amount_not_extracted");
    }
  });

  Deno.test("preserves no-coupon totals", () => {
    const snapshot = extractCheckoutFinancialSnapshot({
      amount_subtotal: 20000,
      amount_total: 20000,
      currency: "brl",
      total_details: { amount_discount: 0 },
    });

    if (!snapshot || snapshot.discountAmountCents !== 0) {
      throw new Error("no_coupon_total_changed");
    }
  });

  Deno.test("falls back to PaymentIntent amount without inventing coupon data", () => {
    const snapshot = createPaymentIntentFinancialSnapshot({
      amountReceivedCents: 16000,
      currency: "brl",
      originalAmountCents: 20000,
    });

    if (!snapshot || snapshot.discountAmountCents !== 4000) {
      throw new Error("payment_intent_fallback_invalid");
    }
    if (snapshot.metadata.source !== "stripe_payment_intent") {
      throw new Error("payment_intent_source_missing");
    }
  });
}
