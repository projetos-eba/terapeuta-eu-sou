import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { DomainError } from "../_shared/payments/http.ts";
import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import {
  mapSessionObservationDatabaseError,
  validateSessionObservationCommand,
} from "./observation-command.ts";

const bookingId = "96000000-0000-4000-8000-000000000001";
const requestId = "96000000-0000-4000-8000-000000000099";

Deno.test("validates and trims one private session observation", () => {
  assertEquals(
    validateSessionObservationCommand({
      bookingId,
      content: "  Retomar o assunto no próximo encontro.  ",
      requestId,
    }),
    {
      bookingId,
      content: "Retomar o assunto no próximo encontro.",
      requestId,
    },
  );
});

Deno.test("rejects invalid IDs, blank content and long observations", () => {
  for (const body of [
    { bookingId: "invalid", content: "Nota", requestId },
    { bookingId, content: " ", requestId },
    { bookingId, content: "x".repeat(4001), requestId },
    { bookingId, content: "Nota", requestId: "invalid" },
  ]) {
    const error = assertThrows(() => validateSessionObservationCommand(body));
    assertEquals(error instanceof DomainError, true);
    assertEquals((error as DomainError).code, "VALIDATION_ERROR");
  }
});

Deno.test("maps plan and timing rejections to product language", () => {
  const planError = mapSessionObservationDatabaseError(
    new SupabaseHttpError(403, "SESSION_OBSERVATION_PREMIUM_PLUS_REQUIRED"),
  );
  assertEquals(planError instanceof DomainError, true);
  assertEquals((planError as DomainError).code, "FORBIDDEN");

  const timingError = mapSessionObservationDatabaseError(
    new SupabaseHttpError(409, "SESSION_OBSERVATION_NOT_AVAILABLE"),
  );
  assertEquals(timingError instanceof DomainError, true);
  assertEquals((timingError as DomainError).code, "UNAVAILABLE");
  assertEquals((timingError as DomainError).message.includes(bookingId), false);
});
