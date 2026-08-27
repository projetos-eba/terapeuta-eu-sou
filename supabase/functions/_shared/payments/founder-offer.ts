import { DomainError } from "./http.ts";

export function assertFounderOfferEligibility(input: {
  plan: "premium" | "premium_plus";
  promotion: {
    offerKey: string | null;
    summary: { code: string };
  };
}) {
  if (
    input.promotion.offerKey !== "therapist_founder" ||
    input.promotion.summary.code.toUpperCase() !== "TERAPEUTAFUNDADOR" ||
    input.plan !== "premium_plus"
  ) {
    throw new DomainError(
      "promotion_offer_mismatch",
      422,
      "Este código promocional é válido apenas para o Premium Plus mensal.",
    );
  }
}
