import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { DomainError } from "../_shared/payments/http.ts";
import { validateSessionFeedbackCommand } from "./feedback-command.ts";

const bookingId = "96000000-0000-4000-8000-000000000001";
const requestId = "96000000-0000-4000-8000-000000000099";

Deno.test("validates a completed feedback with a caller request id", () => {
  assertEquals(
    validateSessionFeedbackCommand({
      bookingId,
      comment: "  Chamada estável. ",
      notPerformedReason: null,
      outcome: "completed",
      rating: 5,
      requestId,
    }),
    {
      bookingId,
      comment: "Chamada estável.",
      notPerformedReason: null,
      outcome: "completed",
      rating: 5,
      requestId,
    },
  );
});

Deno.test("validates a non-performed feedback reason", () => {
  const result = validateSessionFeedbackCommand({
    bookingId,
    comment: "Problema no início.",
    notPerformedReason: "internet_problem",
    outcome: "not_performed",
    rating: null,
    requestId,
  });

  assertEquals(result.outcome, "not_performed");
  assertEquals(result.notPerformedReason, "internet_problem");
});

Deno.test("rejects missing outcome requirements and long comments", () => {
  assertDomainError(() =>
    validateSessionFeedbackCommand({
      bookingId,
      comment: "ok",
      notPerformedReason: null,
      outcome: "completed",
      rating: null,
      requestId,
    }),
  );

  assertDomainError(() =>
    validateSessionFeedbackCommand({
      bookingId,
      comment: "x".repeat(501),
      notPerformedReason: "internet_problem",
      outcome: "not_performed",
      rating: null,
      requestId,
    }),
  );
});

function assertDomainError(callback: () => unknown) {
  const error = assertThrows(callback);
  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "VALIDATION_ERROR");
}
