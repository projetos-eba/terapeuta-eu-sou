import type Stripe from "stripe";

import { DomainError } from "./http.ts";

export type PromotionCheckoutScope = "session" | "subscription";

export type PromotionSummary = {
  amountOffCents?: number;
  code: string;
  couponId: string;
  duration: "forever" | "once" | "repeating";
  durationInMonths?: number;
  percentOff?: number;
  promotionCodeId: string;
};

export type ResolvedPromotionCode = {
  offerKey: string | null;
  promotionCodeId: string;
  summary: PromotionSummary;
};

/**
 * Converts provider-side promotion rejection into a safe TES response. Stripe
 * remains the eligibility authority; this only controls the user-facing error
 * contract when Checkout applies the discount.
 */
export function mapPromotionStripeError(error: unknown): DomainError | null {
  const errorRecord = isRecord(error) ? error : null;
  const rawRecord =
    errorRecord && isRecord(errorRecord.raw) ? errorRecord.raw : null;
  const message =
    [errorRecord?.message, rawRecord?.message]
      .find((value): value is string => typeof value === "string")
      ?.toLowerCase() ?? "";
  const code =
    [errorRecord?.code, rawRecord?.code]
      .find((value): value is string => typeof value === "string")
      ?.toLowerCase() ?? "";
  const param =
    [errorRecord?.param, rawRecord?.param]
      .find((value): value is string => typeof value === "string")
      ?.toLowerCase() ?? "";
  const providerPromotionError =
    param.includes("promotion") ||
    param.includes("discount") ||
    param.includes("coupon") ||
    message.includes("promotion code") ||
    message.includes("coupon") ||
    code.includes("promotion") ||
    code.includes("coupon");

  if (!providerPromotionError) return null;

  if (message.includes("minimum amount") || message.includes("minimum")) {
    return new DomainError(
      "promotion_minimum_amount",
      422,
      "Este código promocional exige um valor mínimo para esta compra.",
    );
  }

  if (message.includes("first-time") || message.includes("first time")) {
    return new DomainError(
      "promotion_first_time_only",
      422,
      "Este código promocional é válido apenas para a primeira compra.",
    );
  }

  if (
    message.includes("redemption") ||
    message.includes("redeem") ||
    message.includes("maximum")
  ) {
    return new DomainError(
      "promotion_redemption_limit",
      422,
      "Este código promocional atingiu o limite de usos.",
    );
  }

  if (message.includes("expired") || message.includes("no longer active")) {
    return new DomainError(
      "promotion_expired",
      422,
      "Este código promocional expirou ou não está mais ativo.",
    );
  }

  return invalidPromotion();
}

type PromotionStripeClient = Pick<Stripe, "coupons" | "promotionCodes">;

export async function resolvePromotionCode(input: {
  checkoutScope: PromotionCheckoutScope;
  code: unknown;
  currency: string;
  customerId: string;
  eligibleProductId?: string;
  originalAmountCents: number;
  stripe: PromotionStripeClient;
}): Promise<ResolvedPromotionCode> {
  const code = normalizePromotionCode(input.code);

  try {
    const page = await input.stripe.promotionCodes.list({
      active: true,
      code,
      limit: 100,
    });
    const candidates = page.data.filter((promotionCode) =>
      isEligibleForCustomer(promotionCode.customer, input.customerId),
    );
    const promotionCode =
      candidates.find(
        (candidate) => customerId(candidate.customer) === input.customerId,
      ) ?? candidates.find((candidate) => candidate.customer === null);

    if (!promotionCode || !promotionCode.active) {
      throw invalidPromotion();
    }

    if (promotionCode.metadata?.tes_checkout_scope !== input.checkoutScope) {
      throw new DomainError(
        "promotion_scope_mismatch",
        422,
        "Este código promocional não é válido para este pagamento.",
      );
    }

    const couponReference = promotionCode.promotion.coupon;
    const coupon =
      typeof couponReference === "string"
        ? await input.stripe.coupons.retrieve(couponReference, {
            expand: ["applies_to"],
          })
        : couponReference;

    if (!coupon || "deleted" in coupon || !coupon.valid) {
      throw invalidPromotion();
    }

    assertCouponCurrency(coupon, input.currency);

    if (input.checkoutScope === "session") {
      if (coupon.duration !== "once") {
        throw new DomainError(
          "promotion_session_duration_invalid",
          422,
          "Este código promocional não é válido para uma sessão.",
        );
      }
      assertSessionPaymentIsNotNegative(
        coupon,
        input.currency,
        input.originalAmountCents,
      );
    } else {
      const products = coupon.applies_to?.products ?? [];
      if (
        !input.eligibleProductId ||
        !products.includes(input.eligibleProductId)
      ) {
        throw new DomainError(
          "promotion_product_mismatch",
          422,
          "Este código promocional não é válido para o plano escolhido.",
        );
      }
    }

    const resolvedAmountOff = amountOffForCurrency(coupon, input.currency);
    return {
      offerKey: metadataValue(promotionCode.metadata, "offer_key"),
      promotionCodeId: promotionCode.id,
      summary: {
        ...(resolvedAmountOff !== null
          ? { amountOffCents: resolvedAmountOff }
          : {}),
        code: promotionCode.code,
        couponId: coupon.id,
        duration: coupon.duration,
        ...(coupon.duration_in_months !== null
          ? { durationInMonths: coupon.duration_in_months }
          : {}),
        ...(coupon.percent_off !== null
          ? { percentOff: coupon.percent_off }
          : {}),
        promotionCodeId: promotionCode.id,
      },
    };
  } catch (error) {
    if (error instanceof DomainError) throw error;

    throw new DomainError(
      "promotion_lookup_failed",
      502,
      "Não foi possível validar o código promocional agora. Tente novamente.",
    );
  }
}

function metadataValue(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
) {
  const value = metadata?.[key]?.trim();
  return value || null;
}

export function normalizePromotionCode(value: unknown) {
  if (typeof value !== "string") throw invalidPromotion();
  const code = value.trim();

  if (!code || code.length > 500 || !/^[a-z0-9-]+$/i.test(code)) {
    throw invalidPromotion();
  }

  return code;
}

export function checkoutAmounts(session: {
  amount_subtotal: number | null;
  amount_total: number | null;
  currency: string | null;
  total_details?: { amount_discount: number } | null;
}) {
  const originalAmountCents = session.amount_subtotal ?? 0;
  const discountAmountCents = session.total_details?.amount_discount ?? 0;
  const totalAmountCents = session.amount_total ?? originalAmountCents;

  return {
    currency: (session.currency ?? "brl").toLowerCase(),
    discountAmountCents,
    originalAmountCents,
    totalAmountCents,
  };
}

function isEligibleForCustomer(
  customer: Stripe.PromotionCode["customer"],
  expectedCustomerId: string,
) {
  const restrictedCustomerId = customerId(customer);
  return (
    restrictedCustomerId === null || restrictedCustomerId === expectedCustomerId
  );
}

function customerId(customer: Stripe.PromotionCode["customer"]) {
  if (customer === null) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function assertCouponCurrency(coupon: Stripe.Coupon, currency: string) {
  if (coupon.amount_off === null) return;
  if (amountOffForCurrency(coupon, currency) === null) {
    throw new DomainError(
      "promotion_currency_mismatch",
      422,
      "Este código promocional não é válido para a moeda deste pagamento.",
    );
  }
}

function amountOffForCurrency(coupon: Stripe.Coupon, currency: string) {
  const normalizedCurrency = currency.toLowerCase();
  if (coupon.currency?.toLowerCase() === normalizedCurrency) {
    return coupon.amount_off;
  }
  return coupon.currency_options?.[normalizedCurrency]?.amount_off ?? null;
}

function assertSessionPaymentIsNotNegative(
  coupon: Stripe.Coupon,
  currency: string,
  originalAmountCents: number,
) {
  const amountOff = amountOffForCurrency(coupon, currency) ?? 0;
  // Stripe supports no-cost one-time Checkout Sessions. A 100% discount or
  // a fixed discount exactly equal to the session amount is therefore valid.
  // Only a discount that would make the amount negative is rejected locally;
  // the final amount remains authoritative to Stripe after session creation.
  if (amountOff > originalAmountCents) {
    throw new DomainError(
      "promotion_amount_exceeds_total",
      422,
      "Este código promocional não pode ser aplicado a esta sessão.",
    );
  }
}

function invalidPromotion() {
  return new DomainError(
    "promotion_invalid",
    422,
    "Código promocional inválido ou indisponível.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
