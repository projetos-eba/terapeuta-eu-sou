import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { shouldApplySessionAttemptEvent } from "./session-attempt-policy.ts";

Deno.test("superseded expiration and failure never mutate the current payment", () => {
  for (const status of ["canceled", "failed", "processing"] as const) {
    assertEquals(
      shouldApplySessionAttemptEvent({
        currentCheckoutSessionId: "cs_current",
        eventCheckoutSessionId: "cs_superseded",
        status,
      }),
      false,
    );
  }
});

Deno.test("current non-success event remains applicable", () => {
  assertEquals(
    shouldApplySessionAttemptEvent({
      currentCheckoutSessionId: "cs_current",
      eventCheckoutSessionId: "cs_current",
      status: "failed",
    }),
    true,
  );
});

Deno.test("a real paid attempt is accepted even after replacement", () => {
  assertEquals(
    shouldApplySessionAttemptEvent({
      currentCheckoutSessionId: "cs_current",
      eventCheckoutSessionId: "cs_previous",
      status: "paid",
    }),
    true,
  );
});
