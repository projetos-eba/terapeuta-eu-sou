import { describe, expect, it } from "vitest";

import {
  parseTherapistReviewCommand,
  TherapistReviewsContractError,
} from "./therapist-reviews.parsers";

const validCommand = {
  action: "reply",
  body: "Obrigada por compartilhar sua experiência.",
  requestId: "11111111-1111-4111-8111-111111111111",
  reviewId: "22222222-2222-4222-8222-222222222222",
};

describe("therapist reviews parser", () => {
  it("accepts a valid reply command", () => {
    expect(parseTherapistReviewCommand(validCommand)).toEqual(validCommand);
  });

  it("rejects unsupported actions and invalid ids", () => {
    expect(() =>
      parseTherapistReviewCommand({ ...validCommand, action: "create_review" }),
    ).toThrow(TherapistReviewsContractError);
    expect(() =>
      parseTherapistReviewCommand({ ...validCommand, reviewId: "livre" }),
    ).toThrow(TherapistReviewsContractError);
  });

  it("rejects reply bodies outside the accepted range", () => {
    expect(() =>
      parseTherapistReviewCommand({ ...validCommand, body: "ok" }),
    ).toThrow(TherapistReviewsContractError);
    expect(() =>
      parseTherapistReviewCommand({ ...validCommand, body: "a".repeat(601) }),
    ).toThrow(TherapistReviewsContractError);
  });
});
