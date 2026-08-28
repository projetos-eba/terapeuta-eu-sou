import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  realEmailCooldownRemainingMs,
  resolveSingleRealEmailActionKey,
} from "./real-email-test-policy.ts";

Deno.test("real email policy requires exactly one supported action", () => {
  assertEquals(
    resolveSingleRealEmailActionKey("booking_confirmed_therapist", [
      "booking_confirmed_therapist",
    ]),
    "booking_confirmed_therapist",
  );
  assertThrows(() => resolveSingleRealEmailActionKey(undefined, ["action"]));
  assertThrows(() => resolveSingleRealEmailActionKey("", ["action"]));
  assertThrows(() => resolveSingleRealEmailActionKey("action,action", ["action"]));
  assertThrows(() => resolveSingleRealEmailActionKey("unknown", ["action"]));
});

Deno.test("real email policy enforces the full 120 second cooldown", () => {
  const attemptedAt = "2026-08-27T12:00:00.000Z";
  assertEquals(
    realEmailCooldownRemainingMs(attemptedAt, Date.parse(attemptedAt)),
    120_000,
  );
  assertEquals(
    realEmailCooldownRemainingMs(
      attemptedAt,
      Date.parse("2026-08-27T12:01:59.999Z"),
    ),
    1,
  );
  assertEquals(
    realEmailCooldownRemainingMs(
      attemptedAt,
      Date.parse("2026-08-27T12:02:00.000Z"),
    ),
    0,
  );
  assertThrows(() => realEmailCooldownRemainingMs("invalid"));
});
