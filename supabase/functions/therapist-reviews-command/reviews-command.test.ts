import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { SupabaseHttpError } from "../_shared/auth/supabase-rest.ts";
import { DomainError } from "../_shared/payments/http.ts";
import {
  mapTherapistReviewsDatabaseError,
  validateTherapistReviewsCommand,
} from "./reviews-command.ts";

const requestId = "a6000000-0000-4000-8000-000000000001";
const reviewId = "b6000000-0000-4000-8000-000000000001";

Deno.test("validates a therapist review reply command", () => {
  const result = validateTherapistReviewsCommand({
    action: "reply",
    body: " Obrigada pelo retorno cuidadoso. ",
    requestId,
    reviewId,
  });

  assertEquals(result, {
    action: "reply",
    body: "Obrigada pelo retorno cuidadoso.",
    requestId,
    reviewId,
  });
});

Deno.test("rejects invalid review reply payloads", () => {
  assertDomainError(() =>
    validateTherapistReviewsCommand({
      action: "reply",
      body: "ok",
      requestId,
      reviewId,
    }),
  );

  assertDomainError(() =>
    validateTherapistReviewsCommand({
      action: "reply",
      body: "Resposta valida.",
      requestId: "invalid-request-id",
      reviewId,
    }),
  );

  assertDomainError(() =>
    validateTherapistReviewsCommand({
      action: "reply",
      body: "Resposta valida.",
      requestId,
      reviewId: "invalid-review-id",
    }),
  );
});

Deno.test("maps therapist review database conflicts", () => {
  const result = mapTherapistReviewsDatabaseError(
    new SupabaseHttpError(400, "REQUEST_CONFLICT"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "REQUEST_CONFLICT");
  assertEquals((result as DomainError).status, 409);
});

Deno.test("maps therapist review capability denials", () => {
  const result = mapTherapistReviewsDatabaseError(
    new SupabaseHttpError(400, "CAPABILITY_NOT_ALLOWED"),
  );

  assertEquals(result instanceof DomainError, true);
  assertEquals((result as DomainError).code, "FORBIDDEN");
  assertEquals((result as DomainError).status, 403);
});

function assertDomainError(callback: () => unknown) {
  const error = assertThrows(callback);
  assertEquals(error instanceof DomainError, true);
  assertEquals((error as DomainError).code, "VALIDATION_ERROR");
}
