import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  mapCancellationDatabaseError,
  resolveCancellationReason,
  validateCancellationCommand,
} from "./cancellation-command.ts";

const bookingId = "b1000000-0000-4000-8000-000000000001";
const requestId = "a1000000-0000-4000-8000-000000000001";

Deno.test("validates a cancellation command with a client command id", () => {
  const result = validateCancellationCommand({
    bookingId,
    reason: "Preciso ajustar minha agenda.",
    requestId,
  });

  assertEquals(result.bookingId, bookingId);
  assertEquals(result.requestId, requestId);
  assertEquals(result.reason, "Preciso ajustar minha agenda.");
});

Deno.test("rejects cancellation commands without an idempotency key", () => {
  const error = assertThrows(() =>
    validateCancellationCommand({ bookingId, reason: "Sem chave." }),
  );

  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "invalid_cancellation_payload");
});

Deno.test(
  "derives cancellation policy reason from the authorized actor",
  () => {
    assertEquals(
      resolveCancellationReason("texto livre", "therapist"),
      "therapist_cancellation",
    );
    assertEquals(
      resolveCancellationReason("therapist_cancellation", "patient"),
      "patient_cancellation",
    );
    assertEquals(resolveCancellationReason("no_show", "therapist"), "no_show");
  },
);

Deno.test("maps divergent replay errors to a safe conflict", () => {
  const error = mapCancellationDatabaseError(
    new SupabaseHttpError(400, "IDEMPOTENCY_KEY_REUSED"),
  );

  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "cancellation_conflict");
  assertEquals((error as DomainError).status, 409);
});
