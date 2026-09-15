import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { DomainError } from "../_shared/payments/http.ts";
import {
  requiresLegacyRetryPreflight,
  resolveReservationCheckoutMode,
} from "./checkout-mode.ts";

Deno.test(
  "an explicit payment retry is not mistaken for an initial hold",
  () => {
    assertEquals(
      resolveReservationCheckoutMode({
        bookingStatus: "pending_payment",
        requestedAttemptKind: "payment_retry",
      }),
      "payment_retry",
    );
  },
);

Deno.test("legacy callers still infer the mode from the booking state", () => {
  assertEquals(
    resolveReservationCheckoutMode({ bookingStatus: "cancelled_by_payment" }),
    "payment_retry",
  );
  assertEquals(
    resolveReservationCheckoutMode({ bookingStatus: "pending_payment" }),
    "initial_hold",
  );
});

Deno.test("a replacement keeps the persisted attempt mode", () => {
  assertEquals(
    resolveReservationCheckoutMode({
      bookingStatus: "pending_payment",
      replacedAttemptKind: "initial_hold",
      requestedAttemptKind: "initial_hold",
    }),
    "initial_hold",
  );
});

Deno.test("a caller cannot change the mode of a persisted attempt", () => {
  const error = assertThrows(
    () =>
      resolveReservationCheckoutMode({
        bookingStatus: "pending_payment",
        replacedAttemptKind: "initial_hold",
        requestedAttemptKind: "payment_retry",
      }),
    DomainError,
  );
  assertEquals(error.code, "checkout_replacement_forbidden");
  assertEquals(error.status, 409);
});

Deno.test("V10 delegates retry claiming to its idempotent command", () => {
  assertEquals(
    requiresLegacyRetryPreflight({
      mode: "payment_retry",
      paymentFlowVersion: "v10",
    }),
    false,
  );
  assertEquals(
    requiresLegacyRetryPreflight({
      mode: "payment_retry",
      paymentFlowVersion: "v9",
    }),
    true,
  );
});
