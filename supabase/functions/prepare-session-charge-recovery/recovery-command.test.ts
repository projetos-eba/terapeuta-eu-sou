import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  parseRecoveryBody,
  validateRecoveryPaymentIntent,
} from "./recovery-command.ts";

const context = {
  amountCents: 17000,
  bookingId: "a0000000-0000-4000-8000-000000000201",
  bookingVersion: 2,
  currency: "BRL",
  environment: "test" as const,
  patientProfileId: "a0000000-0000-4000-8000-000000000202",
  scheduleId: "a0000000-0000-4000-8000-000000000203",
  sessionPaymentId: "a0000000-0000-4000-8000-000000000204",
  stripeCustomerId: "cus_recovery",
  stripePaymentIntentId: "pi_recovery",
};

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    amount: 17000,
    client_secret: "pi_recovery_secret_test",
    currency: "brl",
    customer: "cus_recovery",
    id: "pi_recovery",
    livemode: false,
    metadata: {
      payment_type: "therapy_session",
      tes_booking_version: "2",
      tes_checkout_mode: "t24_charge",
      tes_payment_flow_version: "v10",
      tes_schedule_id: context.scheduleId,
      tes_session_id: context.bookingId,
      tes_session_payment_id: context.sessionPaymentId,
    },
    status: "requires_action",
    ...overrides,
  };
}

Deno.test("recovery returns the same bound PaymentIntent client secret", () => {
  assertEquals(validateRecoveryPaymentIntent(context, paymentIntent()), {
    clientSecret: "pi_recovery_secret_test",
    status: "requires_action",
  });
});

Deno.test(
  "recovery accepts a replacement-card state on the same PaymentIntent",
  () => {
    assertEquals(
      validateRecoveryPaymentIntent(
        context,
        paymentIntent({ status: "requires_payment_method" }),
      ).status,
      "requires_payment_method",
    );
  },
);

Deno.test(
  "recovery fails closed on booking, amount, customer, or environment drift",
  () => {
    for (const changed of [
      { amount: 16999 },
      { customer: "cus_other" },
      { livemode: true },
      { metadata: { ...paymentIntent().metadata, tes_session_id: "other" } },
    ]) {
      assertThrows(
        () => validateRecoveryPaymentIntent(context, paymentIntent(changed)),
        DomainError,
        "Não foi possível validar",
      );
    }
  },
);

Deno.test("recovery body accepts only a booking UUID", () => {
  assertEquals(parseRecoveryBody({ bookingId: context.bookingId }), {
    bookingId: context.bookingId,
  });
  assertThrows(
    () => parseRecoveryBody({ bookingId: "not-a-uuid" }),
    DomainError,
  );
});
