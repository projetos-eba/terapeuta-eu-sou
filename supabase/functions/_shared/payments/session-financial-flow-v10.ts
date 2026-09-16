import type { PromotionSummary } from "./promotion-codes.ts";

export const SESSION_FINANCIAL_FLOW_V10 = "v10";
export const SESSION_FINANCIAL_POLICY_V10 =
  "tes-payments-v10-setup-t24-immediate-transfer";
export const SESSION_FINANCIAL_CONSENT_V10 =
  "tes-session-off-session-consent-v1";
export const SESSION_CHARGE_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

export type SessionChargeTiming = "immediate" | "scheduled";

export function getSessionChargeTiming(
  startsAt: string | Date,
  now = new Date(),
): SessionChargeTiming {
  const startsAtMs =
    startsAt instanceof Date
      ? startsAt.getTime()
      : new Date(startsAt).getTime();

  if (!Number.isFinite(startsAtMs) || startsAtMs <= now.getTime()) {
    return "immediate";
  }

  return startsAtMs - now.getTime() > SESSION_CHARGE_LEAD_TIME_MS
    ? "scheduled"
    : "immediate";
}

export function calculateSessionPromotionAmounts(input: {
  originalAmountCents: number;
  promotion: PromotionSummary | null;
}) {
  const originalAmountCents = requireNonNegativeCents(
    input.originalAmountCents,
  );
  const amountOffCents = input.promotion?.amountOffCents;
  const percentOff = input.promotion?.percentOff;

  let discountAmountCents = 0;
  let discountKind: "fixed" | "percent" | null = null;
  let discountValue: number | null = null;

  if (typeof amountOffCents === "number") {
    discountAmountCents = Math.min(
      originalAmountCents,
      requireNonNegativeCents(amountOffCents),
    );
    discountKind = "fixed";
    discountValue = discountAmountCents;
  } else if (typeof percentOff === "number") {
    const boundedPercent = Math.min(Math.max(percentOff, 0), 100);
    discountAmountCents = Math.min(
      originalAmountCents,
      Math.round((originalAmountCents * boundedPercent) / 100),
    );
    discountKind = "percent";
    discountValue = Math.round(boundedPercent * 100);
  }

  return {
    chargedAmountCents: originalAmountCents - discountAmountCents,
    discountAmountCents,
    discountKind,
    discountValue,
    originalAmountCents,
  };
}

function requireNonNegativeCents(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("invalid_money_amount");
  }
  return value;
}
