import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  mapRescheduleDatabaseError,
  resolveParticipantActorRole,
  resolvePatientRescheduleRpc,
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

Deno.test(
  "derives the reschedule path from the authenticated participant",
  () => {
    assertEquals(
      resolveParticipantActorRole(
        "patient-user",
        "patient-user",
        "therapist-user",
      ),
      "patient",
    );
    assertEquals(
      resolveParticipantActorRole(
        "therapist-user",
        "patient-user",
        "therapist-user",
      ),
      "therapist",
    );
    assertEquals(
      resolveParticipantActorRole(
        "other-user",
        "patient-user",
        "therapist-user",
      ),
      null,
    );
  },
);

Deno.test("validates booking-scoped availability", () => {
  const result = validateRescheduleCommand({
    action: "availability",
    anchor: "2026-09-05",
    bookingId,
    scope: "month",
  });

  assertEquals(result, {
    action: "availability",
    anchor: "2026-09-05",
    bookingId,
    scope: "month",
  });
});

Deno.test(
  "routes only V10 patient reschedules through the pristine charge command",
  () => {
    assertEquals(
      resolvePatientRescheduleRpc("v10"),
      "reschedule_uncharged_session_v10",
    );
    assertEquals(
      resolvePatientRescheduleRpc("v9"),
      "apply_patient_booking_reschedule_v1",
    );
    assertEquals(
      resolvePatientRescheduleRpc(null),
      "apply_patient_booking_reschedule_v1",
    );
  },
);

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

Deno.test("opens a therapist change without requiring a proposed slot", () => {
  const result = validateRescheduleCommand({
    action: "therapist_change",
    bookingId,
    kind: "reschedule",
    reason: "Preciso reorganizar minha agenda.",
    requestId,
  });

  assertEquals(result.action, "therapist_change");
  if (result.action === "therapist_change") {
    assertEquals(result.kind, "reschedule");
  }
});

Deno.test("requires a slot only when the patient chooses rescheduling", () => {
  const refund = validateRescheduleCommand({
    action: "resolve_therapist_change",
    requestId,
    rescheduleRequestId,
    resolution: "refund",
  });
  assertEquals(refund.action, "resolve_therapist_change");

  assertDomainError(() =>
    validateRescheduleCommand({
      action: "resolve_therapist_change",
      requestId,
      rescheduleRequestId,
      resolution: "reschedule",
    }),
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

Deno.test("maps patient conflicts separately", () => {
  const result = mapRescheduleDatabaseError(
    new SupabaseHttpError(400, "PATIENT_SCHEDULE_CONFLICT"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "patient_schedule_conflict");
});

Deno.test("maps divergent idempotency replays safely", () => {
  const result = mapRescheduleDatabaseError(
    new SupabaseHttpError(400, "IDEMPOTENCY_KEY_REUSED"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).status, 409);
  assertEquals((result as DomainError).code, "reschedule_not_allowed");
});

Deno.test("maps a therapist direct-apply attempt as forbidden", () => {
  const result = mapRescheduleDatabaseError(
    new SupabaseHttpError(400, "BOOKING_ACTOR_NOT_PATIENT"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).status, 403);
  assertEquals((result as DomainError).code, "reschedule_forbidden");
});

Deno.test("maps a claimed V10 charge to the support-safe response", () => {
  const result = mapRescheduleDatabaseError(
    new SupabaseHttpError(
      400,
      "SESSION_PRECHARGE_RESCHEDULE_V10_REQUIRES_SUPPORT",
    ),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "reschedule_not_allowed");
  assertEquals((result as DomainError).status, 409);
});

Deno.test("maps the therapist 48-hour notice requirement safely", () => {
  const result = mapRescheduleDatabaseError(
    new SupabaseHttpError(
      400,
      "SESSION_PRECHARGE_THERAPIST_RESCHEDULE_V10_MINIMUM_NOTICE",
    ),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals(
    (result as DomainError).code,
    "reschedule_notice_window_required",
  );
  assertEquals((result as DomainError).status, 409);
});

Deno.test(
  "keeps therapist V10 actions fail-closed after a payment race",
  () => {
    const result = mapRescheduleDatabaseError(
      new SupabaseHttpError(
        400,
        "SESSION_PRECHARGE_THERAPIST_CANCEL_V10_PAYMENT_CHANGED",
      ),
    );

    assertEquals(result instanceof DomainError, true);
    assertEquals((result as DomainError).code, "reschedule_not_allowed");
    assertEquals((result as DomainError).status, 409);
  },
);

Deno.test("keeps therapist V10 cancellation closed while a request is pending", () => {
  const result = mapRescheduleDatabaseError(
    new SupabaseHttpError(
      400,
      "SESSION_PRECHARGE_THERAPIST_CANCEL_V10_RESCHEDULE_PENDING",
    ),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "reschedule_not_allowed");
  assertEquals((result as DomainError).status, 409);
});

function assertDomainError(callback: () => unknown) {
  const error = assertThrows(callback);
  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "invalid_reschedule_payload");
}
