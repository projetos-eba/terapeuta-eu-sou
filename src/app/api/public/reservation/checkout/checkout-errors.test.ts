import { describe, expect, it } from "vitest";

import { mapCheckoutError } from "./checkout-errors";

describe("mapCheckoutError", () => {
  it("explains a booking-only suspension separately from an incorrect role", () => {
    const result = mapCheckoutError({
      code: "patient_booking_suspended",
      status: 403,
    });
    expect(result.code).toBe("PATIENT_BOOKING_SUSPENDED");
    expect(result.message).toContain(
      "encontros já contratados permanecem disponíveis",
    );
    expect(mapCheckoutError({ status: 403 }).code).toBe("FORBIDDEN");
  });
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

  it.each([
    "booking_not_payable",
    "checkout_already_confirming",
    "checkout_replacement_conflict",
    "checkout_replacement_forbidden",
    "checkout_replacement_required",
  ])("does not describe %s as an unavailable time", (code) => {
    expect(mapCheckoutError({ code, status: 409 })).toEqual({
      code: "PAYMENT_UPDATED",
      message:
        "O pagamento foi atualizado. Confira a situação antes de tentar novamente.",
    });
  });

  it("describes an expired reservation without exposing implementation terms", () => {
    expect(
      mapCheckoutError({ code: "reservation_expired", status: 409 }),
    ).toEqual({
      code: "RESERVATION_EXPIRED",
      message:
        "O prazo desta reserva terminou. Verifique a situação para continuar.",
    });
  });
});
