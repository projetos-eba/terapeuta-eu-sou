import { assertEquals } from "jsr:@std/assert";

import { resolveRecoverableCaptureAction } from "./capture-recovery-policy.ts";

Deno.test("capture recovery reconciles known terminal Stripe states", () => {
  const common = { nowMs: 600_000, slotClaimedAt: new Date(0).toISOString() };

  assertEquals(
    resolveRecoverableCaptureAction({
      ...common,
      paymentIntentStatus: "succeeded",
    }),
    "reconcile_paid",
  );
  assertEquals(
    resolveRecoverableCaptureAction({
      ...common,
      paymentIntentStatus: "canceled",
    }),
    "reconcile_canceled",
  );
  assertEquals(
    resolveRecoverableCaptureAction({
      ...common,
      paymentIntentStatus: "requires_payment_method",
    }),
    "reconcile_failed",
  );
});

Deno.test(
  "capture recovery captures only a recent capturable authorization",
  () => {
    assertEquals(
      resolveRecoverableCaptureAction({
        nowMs: 299_999,
        paymentIntentStatus: "requires_capture",
        slotClaimedAt: new Date(0).toISOString(),
      }),
      "capture_authorization",
    );
    assertEquals(
      resolveRecoverableCaptureAction({
        nowMs: 300_001,
        paymentIntentStatus: "requires_capture",
        slotClaimedAt: new Date(0).toISOString(),
      }),
      "cancel_authorization",
    );
  },
);

Deno.test(
  "capture recovery keeps an unknown or malformed state blocked",
  () => {
    assertEquals(
      resolveRecoverableCaptureAction({
        nowMs: 600_000,
        paymentIntentStatus: "processing",
        slotClaimedAt: new Date(0).toISOString(),
      }),
      "keep_blocked",
    );
    assertEquals(
      resolveRecoverableCaptureAction({
        nowMs: 600_000,
        paymentIntentStatus: "requires_capture",
        slotClaimedAt: "invalid",
      }),
      "keep_blocked",
    );
  },
);
