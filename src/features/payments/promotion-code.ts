export type PromotionSummary = {
  amountOffCents?: number;
  code: string;
  couponId: string;
  duration: "forever" | "once" | "repeating";
  durationInMonths?: number;
  percentOff?: number;
  promotionCodeId: string;
};

export type PromotionCheckoutAmounts = {
  currency: string;
  discountAmountCents: number;
  originalAmountCents: number;
  promotion: PromotionSummary | null;
  totalAmountCents: number;
};
