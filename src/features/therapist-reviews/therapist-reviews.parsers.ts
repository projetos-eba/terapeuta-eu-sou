import type { TherapistReviewReplyCommand } from "./therapist-reviews.types";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TherapistReviewsContractError extends Error {
  constructor(readonly code = "invalid_payload") {
    super("Therapist reviews payload does not match contract v1.");
  }
}

export function parseTherapistReviewCommand(
  input: unknown,
): TherapistReviewReplyCommand {
  const value = record(input);
  const action = string(value.action);

  if (action !== "reply") invalid();

  return {
    action,
    body: boundedString(value.body, 3, 600),
    requestId: uuid(value.requestId),
    reviewId: uuid(value.reviewId),
  };
}

function boundedString(value: unknown, min: number, max: number) {
  const result = string(value).trim();
  if (result.length < min || result.length > max) invalid();
  return result;
}

function invalid(): never {
  throw new TherapistReviewsContractError();
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value;
}

function uuid(value: unknown) {
  const result = string(value).trim();
  if (!UUID.test(result)) invalid();
  return result;
}
