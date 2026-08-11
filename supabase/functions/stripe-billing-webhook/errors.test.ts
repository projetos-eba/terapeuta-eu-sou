import { assertEquals, assertInstanceOf } from "jsr:@std/assert";

import { DomainError } from "../_shared/payments/http.ts";
import { normalizeStripeBillingWebhookError } from "./errors.ts";

Deno.test("maps Stripe signature verification failures to a 400 domain error", () => {
  const rawError = Object.assign(new Error("signature mismatch"), {
    type: "StripeSignatureVerificationError",
  });

  const result = normalizeStripeBillingWebhookError(rawError);

  assertInstanceOf(result, DomainError);
  assertEquals(result.code, "stripe_webhook_signature_invalid");
  assertEquals(result.status, 400);
  assertEquals(result.message, "Assinatura do webhook Stripe invalida.");
});

Deno.test("preserves non-signature webhook failures", () => {
  const rawError = new Error("database offline");

  const result = normalizeStripeBillingWebhookError(rawError);

  assertEquals(result, rawError);
});
