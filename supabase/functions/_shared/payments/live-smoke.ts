export type LiveSmokeDiscountConfig = {
  enabledValue?: string | null;
  couponId?: string | null;
  stripeMode: "live" | "test";
  therapistProfileId: string;
  therapistProfileIdAllowlist?: string | null;
};

export type LiveSmokeDiscount =
  | {
      coupon: string;
    }
  | never;

export function getLiveSmokeCheckoutDiscounts(
  config: LiveSmokeDiscountConfig,
): LiveSmokeDiscount[] {
  if (config.stripeMode !== "live") return [];
  if (config.enabledValue?.trim() !== "true") return [];
  if (!isUuid(config.therapistProfileId)) return [];
  if (config.therapistProfileIdAllowlist?.trim() !== config.therapistProfileId) {
    return [];
  }

  const coupon = config.couponId?.trim();
  if (!coupon || !isStripeCouponId(coupon)) return [];

  return [{ coupon }];
}

export function isLiveSmokeCouponConfigured(
  config: Omit<LiveSmokeDiscountConfig, "stripeMode">,
) {
  return (
    config.enabledValue?.trim() === "true" &&
    isUuid(config.therapistProfileId) &&
    config.therapistProfileIdAllowlist?.trim() === config.therapistProfileId &&
    isStripeCouponId(config.couponId?.trim() ?? "")
  );
}

function isStripeCouponId(value: string) {
  return /^[A-Za-z0-9_:-]{3,128}$/.test(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
