import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { isEligibleAtOperationInstant } from "./payout-worker.ts";

Deno.test(
  "worker uses the authorized operation instant for eligibility",
  () => {
    assertEquals(
      isEligibleAtOperationInstant(
        "2026-09-29T13:20:00.000Z",
        "2026-09-29T13:20:00.000Z",
      ),
      true,
    );
    assertEquals(
      isEligibleAtOperationInstant(
        "2026-09-29T13:20:00.000Z",
        "2026-09-29T13:19:59.999Z",
      ),
      false,
    );
  },
);

Deno.test("worker fails closed for missing or invalid instants", () => {
  assertEquals(
    isEligibleAtOperationInstant(null, "2026-09-29T13:20:00Z"),
    false,
  );
  assertEquals(
    isEligibleAtOperationInstant("invalid", "2026-09-29T13:20:00Z"),
    false,
  );
  assertEquals(
    isEligibleAtOperationInstant("2026-09-29T13:20:00Z", "invalid"),
    false,
  );
});
