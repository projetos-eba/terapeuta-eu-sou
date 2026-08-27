import { assertEquals, assertThrows } from "jsr:@std/assert@1";

import { validatePatientReviewCommand } from "./review-command.ts";

const requestId = "10000000-0000-4000-8000-000000000001";
const therapistProfileId = "20000000-0000-4000-8000-000000000002";

Deno.test("accepts an immediately published review payload", () => {
  assertEquals(
    validatePatientReviewCommand({
      action: "save",
      comment: "  Acolhimento excelente.  ",
      rating: 5,
      requestId,
      therapistProfileId,
    }),
    {
      action: "save",
      comment: "Acolhimento excelente.",
      rating: 5,
      requestId,
      therapistProfileId,
    },
  );
});

Deno.test("accepts hiding without a rating", () => {
  assertEquals(
    validatePatientReviewCommand({
      action: "hide",
      requestId,
      therapistProfileId,
    }).rating,
    null,
  );
});

Deno.test("rejects public review without a rating", () => {
  assertThrows(() =>
    validatePatientReviewCommand({
      action: "publish",
      requestId,
      therapistProfileId,
    })
  );
});
