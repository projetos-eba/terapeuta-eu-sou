import { describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";

import {
  getSafeTherapistContinuation,
  getTherapistCheckoutHref,
  getTherapistLoginHref,
  getTherapistLoginRedirect,
  getTherapistPostSignupHref,
  isPaidTherapistPlan,
} from "./routing";

describe("therapist auth routing", () => {
  it("keeps Free signup outside checkout", () => {
    expect(isPaidTherapistPlan(TherapistPlan.Free)).toBe(false);
    expect(getTherapistPostSignupHref(TherapistPlan.Free)).toBe(
      `${routes.public.therapistSignIn}?created=1`,
    );
  });

  it.each([TherapistPlan.Premium, TherapistPlan.PremiumPlus])(
    "routes %s signup to checkout",
    (plan) => {
      expect(isPaidTherapistPlan(plan)).toBe(true);
      expect(getTherapistPostSignupHref(plan)).toBe(
        `${getTherapistCheckoutHref(plan)}&created=1`,
      );
    },
  );

  it("accepts only paid checkout continuations", () => {
    const checkout = getTherapistCheckoutHref(TherapistPlan.Premium);

    expect(getSafeTherapistContinuation(checkout)).toBe(checkout);
    expect(getSafeTherapistContinuation("https://example.com")).toBeNull();
    expect(getSafeTherapistContinuation("/plus")).toBeNull();
    expect(
      getSafeTherapistContinuation(
        `${routes.public.therapistCheckout}?plan=free`,
      ),
    ).toBeNull();
  });

  it("keeps checkout continuation on login without adding signup status by default", () => {
    const checkout = getTherapistCheckoutHref(TherapistPlan.Premium);

    expect(getTherapistLoginHref(checkout)).toBe(
      `${routes.public.therapistSignIn}?next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium`,
    );
    expect(getTherapistLoginHref(checkout, { created: true })).toBe(
      `${routes.public.therapistSignIn}?created=1&next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium`,
    );
  });

  it("falls back to the active plan dashboard after login", () => {
    expect(
      getTherapistLoginRedirect(
        TherapistPlan.Free,
        "https://example.com/steal-session",
      ),
    ).toBe(routes.therapist.home);
    expect(
      getTherapistLoginRedirect(
        TherapistPlan.Free,
        getTherapistCheckoutHref(TherapistPlan.PremiumPlus),
      ),
    ).toBe(getTherapistCheckoutHref(TherapistPlan.PremiumPlus));
  });
});
