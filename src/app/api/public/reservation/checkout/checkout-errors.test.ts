import { describe, expect, it } from "vitest";

import { mapCheckoutError } from "./checkout-errors";

describe("mapCheckoutError", () => {
  it("preserves a patient schedule conflict", () => {
    expect(
      mapCheckoutError({ code: "patient_schedule_conflict", status: 409 }),
    ).toEqual({
      code: "PATIENT_SCHEDULE_CONFLICT",
      message:
        "Você já tem outro encontro nesse horário. Escolha outro momento.",
    });
  });

  it("keeps other conflicts generic", () => {
    expect(
      mapCheckoutError({ code: "booking_conflict", status: 409 }).code,
    ).toBe("SLOT_CONFLICT");
  });
});
