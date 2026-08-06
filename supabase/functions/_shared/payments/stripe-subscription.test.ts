import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getStripeInvoiceSubscriptionId,
  getStripeSubscriptionPeriod,
  getStripeSubscriptionScheduleId,
} from "./stripe-subscription.ts";

Deno.test(
  "reads subscription period from the top-level subscription shape",
  () => {
    assertEquals(
      getStripeSubscriptionPeriod({
        current_period_end: 200,
        current_period_start: 100,
        items: { data: [] },
      }),
      {
        currentPeriodEnd: 200,
        currentPeriodStart: 100,
      },
    );
  },
);

Deno.test(
  "falls back to subscription item period for current Stripe API shape",
  () => {
    assertEquals(
      getStripeSubscriptionPeriod({
        items: {
          data: [
            {
              current_period_end: 400,
              current_period_start: 300,
            },
          ],
        },
      }),
      {
        currentPeriodEnd: 400,
        currentPeriodStart: 300,
      },
    );
  },
);

Deno.test(
  "reads subscription schedule id from string or expanded object",
  () => {
    assertEquals(
      getStripeSubscriptionScheduleId({ schedule: "sub_sched_test" }),
      "sub_sched_test",
    );
    assertEquals(
      getStripeSubscriptionScheduleId({
        schedule: { id: "sub_sched_expanded" },
      }),
      "sub_sched_expanded",
    );
    assertEquals(getStripeSubscriptionScheduleId({ schedule: null }), null);
  },
);

Deno.test(
  "reads invoice subscription id from legacy and current Stripe invoice shapes",
  () => {
    assertEquals(
      getStripeInvoiceSubscriptionId({ subscription: "sub_top_level" }),
      "sub_top_level",
    );
    assertEquals(
      getStripeInvoiceSubscriptionId({
        parent: {
          subscription_details: {
            subscription: "sub_parent_details",
          },
        },
      }),
      "sub_parent_details",
    );
    assertEquals(
      getStripeInvoiceSubscriptionId({
        lines: {
          data: [
            {
              parent: {
                subscription_item_details: {
                  subscription: "sub_line_parent",
                },
              },
            },
          ],
        },
      }),
      "sub_line_parent",
    );
    assertEquals(getStripeInvoiceSubscriptionId({ parent: null }), null);
  },
);
