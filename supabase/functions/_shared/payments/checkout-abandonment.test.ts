import { assertEquals } from "jsr:@std/assert@1";

import {
  expireOpenCheckoutForAbandonment,
  isCurrentCheckoutForAbandonment,
} from "./checkout-abandonment.ts";
import type { StripeClient } from "./stripe-client.ts";

function stripeWithCheckoutStatus(status: "complete" | "expired" | "open") {
  const expireCalls: string[] = [];
  const stripe = {
    checkout: {
      sessions: {
        expire: async (id: string) => {
          expireCalls.push(id);
          return { id, status: "expired" };
        },
        retrieve: async () => ({ status }),
      },
    },
  } as unknown as Pick<StripeClient, "checkout">;

  return { expireCalls, stripe };
}

Deno.test(
  "abandonment expires an open Checkout before releasing its booking",
  async () => {
    const { expireCalls, stripe } = stripeWithCheckoutStatus("open");

    const released = await expireOpenCheckoutForAbandonment({
      checkoutSessionId: "cs_test_open",
      stripe,
    });

    assertEquals(released, true);
    assertEquals(expireCalls, ["cs_test_open"]);
  },
);

Deno.test(
  "abandonment never releases a Checkout that is already complete",
  async () => {
    const { expireCalls, stripe } = stripeWithCheckoutStatus("complete");

    const released = await expireOpenCheckoutForAbandonment({
      checkoutSessionId: "cs_test_complete",
      stripe,
    });

    assertEquals(released, false);
    assertEquals(expireCalls, []);
  },
);

Deno.test(
  "a stale abandonment cannot release the Checkout that replaced it",
  () => {
    assertEquals(
      isCurrentCheckoutForAbandonment({
        currentCheckoutSessionId: "cs_current",
        requestedCheckoutSessionId: "cs_superseded",
      }),
      false,
    );
    assertEquals(
      isCurrentCheckoutForAbandonment({
        currentCheckoutSessionId: "cs_current",
        requestedCheckoutSessionId: "cs_current",
      }),
      true,
    );
  },
);
