import {
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  mapBookingCheckoutDatabaseError,
  resolveExistingCheckoutHold,
  selectAvailableSlot,
  slotRangeEnd,
  validateBookingCheckoutCommand,
} from "./booking-checkout-command.ts";

const requestId = "a6000000-0000-4000-8000-000000000001";
const serviceId = "d1000000-0000-4000-8000-000000000001";
const startsAt = "2026-07-28T12:00:00.000Z";
const endsAt = "2026-07-28T12:50:00.000Z";

Deno.test(
  "booking checkout command accepts a minimal idempotent payload",
  () => {
    const command = validateBookingCheckoutCommand({
      requestId,
      serviceId,
      startsAt,
      termsAccepted: true,
    });

    assertEquals(command.holdTtlSeconds, 600);
    assertEquals(command.requestId, requestId);
    assertEquals(command.serviceId, serviceId);
    assertEquals(command.sharedNote, null);
    assertEquals(command.startsAt, startsAt);
  },
);

Deno.test(
  "booking checkout command preserves the shared preparation note",
  () => {
    const command = validateBookingCheckoutCommand({
      requestId,
      serviceId,
      sharedNote: "  Quero chegar com calma.  ",
      startsAt,
      termsAccepted: true,
    });

    assertEquals(command.sharedNote, "Quero chegar com calma.");
  },
);

Deno.test("booking checkout command bounds the shared preparation note", () => {
  const error = assertThrows(
    () =>
      validateBookingCheckoutCommand({
        requestId,
        serviceId,
        sharedNote: "x".repeat(601),
        startsAt,
        termsAccepted: true,
      }),
    DomainError,
  );

  assertEquals(error.code, "invalid_booking_checkout_payload");
  assertEquals(error.status, 422);
});

Deno.test(
  "booking checkout command rejects invalid identifiers and ttl",
  () => {
    assertEquals(
      assertThrows(
        () =>
          validateBookingCheckoutCommand({
            requestId: "same-click",
            serviceId,
            startsAt,
            termsAccepted: true,
          }),
        DomainError,
      ).code,
      "invalid_booking_checkout_payload",
    );
    assertEquals(
      assertThrows(
        () =>
          validateBookingCheckoutCommand({
            holdTtlSeconds: 30,
            requestId,
            serviceId,
            startsAt,
            termsAccepted: true,
          }),
        DomainError,
      ).status,
      422,
    );
  },
);

Deno.test("booking checkout command requires terms acceptance", () => {
  const error = assertThrows(
    () =>
      validateBookingCheckoutCommand({
        requestId,
        serviceId,
        startsAt,
      }),
    DomainError,
  );

  assertEquals(error.code, "terms_required");
  assertEquals(error.status, 428);
});

Deno.test(
  "booking checkout command selects the exact authoritative slot",
  () => {
    const slot = selectAvailableSlot(
      {
        contractVersion: 1,
        slots: [
          {
            endsAt: "2026-07-28T11:50:00.000Z",
            startsAt: "2026-07-28T11:00:00.000Z",
          },
          { endsAt, startsAt },
        ],
        timezone: "America/Sao_Paulo",
      },
      startsAt,
    );

    assertEquals(slot, {
      endsAt,
      startsAt,
      timezone: "America/Sao_Paulo",
    });
  },
);

Deno.test(
  "booking checkout command rejects a missing authoritative slot",
  () => {
    const error = assertThrows(
      () =>
        selectAvailableSlot(
          {
            contractVersion: 1,
            slots: [],
            timezone: "America/Sao_Paulo",
          },
          startsAt,
        ),
      DomainError,
    );

    assertEquals(error.code, "slot_not_available");
    assertEquals(error.status, 409);
  },
);

Deno.test("booking checkout command derives a bounded lookup range", () => {
  assertEquals(slotRangeEnd(startsAt), "2026-07-29T12:00:00.000Z");
});

Deno.test(
  "booking checkout resumes a consumed idempotent hold before checking availability",
  () => {
    const command = validateBookingCheckoutCommand({
      requestId,
      serviceId,
      startsAt,
      termsAccepted: true,
    });
    const result = resolveExistingCheckoutHold(
      {
        consumedBookingId: "b6000000-0000-4000-8000-000000000001",
        endsAt,
        expiresAt: "2026-07-28T12:10:00.000Z",
        id: "c6000000-0000-4000-8000-000000000001",
        patientProfileId: "b1000000-0000-4000-8000-000000000005",
        serviceId,
        startsAt,
        status: "consumed",
        timezone: "America/Sao_Paulo",
      },
      command,
      "b1000000-0000-4000-8000-000000000005",
    );

    assertEquals(result?.bookingId, "b6000000-0000-4000-8000-000000000001");
    assertEquals(result?.hold.id, "c6000000-0000-4000-8000-000000000001");
  },
);

Deno.test("booking checkout rejects a reused attempt with different input", () => {
  const command = validateBookingCheckoutCommand({
    requestId,
    serviceId,
    startsAt,
    termsAccepted: true,
  });
  const error = assertThrows(
    () =>
      resolveExistingCheckoutHold(
        {
          consumedBookingId: "b6000000-0000-4000-8000-000000000001",
          endsAt,
          expiresAt: "2026-07-28T12:10:00.000Z",
          id: "c6000000-0000-4000-8000-000000000001",
          patientProfileId: "b1000000-0000-4000-8000-000000000005",
          serviceId,
          startsAt: "2026-07-28T12:10:00.000Z",
          status: "consumed",
          timezone: "America/Sao_Paulo",
        },
        command,
        "b1000000-0000-4000-8000-000000000005",
      ),
    DomainError,
  );

  assertEquals(error.code, "idempotency_key_reused");
});

Deno.test("booking checkout command maps A2 and A5 database errors", () => {
  const unavailable = mapBookingCheckoutDatabaseError(
    new SupabaseHttpError(400, "SLOT_NOT_AVAILABLE"),
  );
  const held = mapBookingCheckoutDatabaseError(
    new SupabaseHttpError(400, "SLOT_HELD_BY_ANOTHER_USER"),
  );
  const conflict = mapBookingCheckoutDatabaseError(
    new SupabaseHttpError(400, "BOOKING_CONFLICT"),
  );
  const patientConflict = mapBookingCheckoutDatabaseError(
    new SupabaseHttpError(400, "PATIENT_SCHEDULE_CONFLICT"),
  );

  assertEquals((unavailable as DomainError).code, "slot_not_available");
  assertEquals((held as DomainError).code, "slot_held_by_another_user");
  assertEquals((conflict as DomainError).code, "booking_conflict");
  assertEquals(
    (patientConflict as DomainError).code,
    "patient_schedule_conflict",
  );
  assertEquals((patientConflict as DomainError).status, 409);
});

Deno.test("booking checkout command maps missing legal publication", () => {
  const error = mapBookingCheckoutDatabaseError(
    new SupabaseHttpError(400, "published legal document not found"),
  );

  assertEquals((error as DomainError).code, "legal_document_not_published");
  assertEquals((error as DomainError).status, 428);
});

Deno.test("booking checkout command preserves unknown errors", () => {
  const original = new Error("network");

  assertStrictEquals(mapBookingCheckoutDatabaseError(original), original);
});
