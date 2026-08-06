import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getSubscriptionIdentity,
  getSubscriptionPriceId,
  normalizeSubscriptionStatus,
  resolveCheckoutStatus,
} from "./subscription-sync.ts";

Deno.test("maps subscription metadata aliases to therapist identity", () => {
  assertEquals(
    getSubscriptionIdentity({
      therapist_profile_id: "therapist-profile",
      therapist_user_id: "therapist-user",
      tes_therapist_id: "legacy-profile",
      user_id: "legacy-user",
    }),
    {
      therapistProfileId: "therapist-profile",
      therapistUserId: "therapist-user",
    },
  );

  assertEquals(
    getSubscriptionIdentity({
      tes_therapist_id: "legacy-profile",
      user_id: "legacy-user",
    }),
    {
      therapistProfileId: "legacy-profile",
      therapistUserId: "legacy-user",
    },
  );
});

Deno.test("reads the subscription price from the first Stripe item", () => {
  assertEquals(
    getSubscriptionPriceId({
      items: {
        data: [
          {
            price: {
              id: "price_premium_plus",
            },
          },
        ],
      },
    }),
    "price_premium_plus",
  );

  assertEquals(getSubscriptionPriceId({ items: { data: [] } }), null);
});

Deno.test("normalizes unknown Stripe subscription statuses closed", () => {
  assertEquals(normalizeSubscriptionStatus("active"), "active");
  assertEquals(normalizeSubscriptionStatus("trialing"), "trialing");
  assertEquals(
    normalizeSubscriptionStatus("incomplete_expired"),
    "incomplete_expired",
  );
  assertEquals(
    normalizeSubscriptionStatus("unknown_future_status"),
    "incomplete",
  );
});

Deno.test("maps paid active subscription checkout to active", () => {
  assertEquals(
    resolveCheckoutStatus({
      checkoutPaymentStatus: "paid",
      checkoutStatus: "complete",
      subscriptionStatus: "active",
    }),
    "active",
  );
  assertEquals(
    resolveCheckoutStatus({
      checkoutPaymentStatus: "paid",
      checkoutStatus: "complete",
      subscriptionStatus: "trialing",
    }),
    "active",
  );
});

Deno.test(
  "does not activate incomplete or failed subscription checkout states",
  () => {
    assertEquals(
      resolveCheckoutStatus({
        checkoutPaymentStatus: "unpaid",
        checkoutStatus: "open",
        subscriptionStatus: "incomplete",
      }),
      "pending",
    );
    assertEquals(
      resolveCheckoutStatus({
        checkoutPaymentStatus: "unpaid",
        checkoutStatus: "complete",
        subscriptionStatus: "incomplete",
      }),
      "failed",
    );
    assertEquals(
      resolveCheckoutStatus({
        checkoutPaymentStatus: "unpaid",
        checkoutStatus: "expired",
        subscriptionStatus: "incomplete_expired",
      }),
      "expired",
    );
  },
);

Deno.test(
  "maps payment recovery states without downgrading prematurely",
  () => {
    assertEquals(
      resolveCheckoutStatus({
        checkoutPaymentStatus: "unpaid",
        checkoutStatus: "complete",
        subscriptionStatus: "past_due",
      }),
      "requires_action",
    );
    assertEquals(
      resolveCheckoutStatus({
        checkoutPaymentStatus: "unpaid",
        checkoutStatus: "complete",
        subscriptionStatus: "unpaid",
      }),
      "requires_action",
    );
    assertEquals(
      resolveCheckoutStatus({
        checkoutPaymentStatus: "paid",
        checkoutStatus: "complete",
        subscriptionStatus: "canceled",
      }),
      "pending",
    );
  },
);
