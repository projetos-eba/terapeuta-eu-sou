import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { assertFounderOfferEligibility } from "./founder-offer.ts";
import { DomainError } from "./http.ts";

const founderPromotion = {
  offerKey: "therapist_founder",
  summary: { code: "TERAPEUTAFUNDADOR" },
};

Deno.test("founder offer accepts Premium Plus", () => {
  assertFounderOfferEligibility({
    plan: "premium_plus",
    promotion: founderPromotion,
  });
});

Deno.test("founder offer rejects Premium", async () => {
  const error = await assertRejects(
    () =>
      Promise.resolve().then(() =>
        assertFounderOfferEligibility({
          plan: "premium",
          promotion: founderPromotion,
        }),
      ),
    DomainError,
  );
  assertEquals(error.code, "promotion_offer_mismatch");
});

Deno.test("founder offer rejects untrusted offer metadata", async () => {
  const error = await assertRejects(
    () =>
      Promise.resolve().then(() =>
        assertFounderOfferEligibility({
          plan: "premium_plus",
          promotion: {
            offerKey: "other_offer",
            summary: { code: "TERAPEUTAFUNDADOR" },
          },
        }),
      ),
    DomainError,
  );
  assertEquals(error.code, "promotion_offer_mismatch");
});
