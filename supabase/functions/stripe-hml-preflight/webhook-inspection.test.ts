import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  fingerprintStripeIdentifier,
  parseStripeEventId,
} from "./webhook-inspection.ts";

Deno.test("parseStripeEventId accepts only Stripe event identifiers", () => {
  assertEquals(parseStripeEventId("evt_1TestEvent123"), "evt_1TestEvent123");
  assertEquals(parseStripeEventId("cs_test_123"), null);
  assertEquals(parseStripeEventId("evt_unsafe-value"), null);
  assertEquals(parseStripeEventId(undefined), null);
});

Deno.test("fingerprintStripeIdentifier is stable and does not return the identifier", async () => {
  const eventId = "evt_1TestEvent123";
  const fingerprint = await fingerprintStripeIdentifier(eventId);

  assert(fingerprint.startsWith("sha256:"));
  assertEquals(fingerprint.includes(eventId), false);
  assertEquals(fingerprint, await fingerprintStripeIdentifier(eventId));
});
