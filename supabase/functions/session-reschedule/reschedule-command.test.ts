import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  mapRescheduleDatabaseError,
  rescheduleSlotRangeEnd,
  selectRescheduleSlot,
  validateRescheduleCommand,
} from "./reschedule-command.ts";

const requestId = "a1000000-0000-4000-8000-000000000001";
const bookingId = "b1000000-0000-4000-8000-000000000001";
const rescheduleRequestId = "c1000000-0000-4000-8000-000000000001";
const futureStartsAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

Deno.test("validates a future reschedule request", () => {
  const result = validateRescheduleCommand({
    action: "request",
    bookingId,
    expectedBookingVersion: 2,
    proposedStartsAt: futureStartsAt,
    reason: "Preciso ajustar meu horario.",
    requestId,
  });

  assertEquals(result.action, "request");
  if (result.action === "request") {
    assertEquals(result.bookingId, bookingId);
    assertEquals(result.expectedBookingVersion, 2);
  }
});

Deno.test("rejects invalid request payloads", () => {
  assertDomainError(() =>
    validateRescheduleCommand({
      action: "request",
      bookingId,
      proposedStartsAt: "not-a-date",
      requestId,
    }),
  );
});

Deno.test("validates reschedule resolution", () => {
  const result = validateRescheduleCommand({
    action: "resolve",
    requestId,
    rescheduleRequestId,
    resolution: "accepted",
  });

  assertEquals(result.action, "resolve");
  if (result.action === "resolve") assertEquals(result.resolution, "accepted");
});

Deno.test("selects an exact authoritative slot", () => {
  const result = selectRescheduleSlot(
    {
      contractVersion: 1,
      slots: [
        {
          endsAt: new Date(Date.parse(futureStartsAt) + 50 * 60_000).toISOString(),
          startsAt: futureStartsAt,
        },
      ],
      timezone: "America/Sao_Paulo",
    },
    futureStartsAt,
  );

  assertEquals(result.startsAt, futureStartsAt);
});

Deno.test("uses a one-day slot lookup range", () => {
  assertEquals(
    Date.parse(rescheduleSlotRangeEnd(futureStartsAt)) -
      Date.parse(futureStartsAt),
    86_400_000,
  );
});

Deno.test("maps database conflicts safely", () => {
  const result = mapRescheduleDatabaseError(
    new SupabaseHttpError(400, "BOOKING_CONFLICT"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).status, 409);
  assertEquals((result as DomainError).code, "reschedule_slot_conflict");
});

Deno.test("maps divergent idempotency replays safely", () => {
  const result = mapRescheduleDatabaseError(
    new SupabaseHttpError(400, "IDEMPOTENCY_KEY_REUSED"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).status, 409);
  assertEquals((result as DomainError).code, "reschedule_not_allowed");
});

function assertDomainError(callback: () => unknown) {
  const error = assertThrows(callback);
  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "invalid_reschedule_payload");
}
