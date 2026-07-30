import { describe, expect, it } from "vitest";

import { resolveReservationContext } from "./reservation-data";

describe("public reservation data contract", () => {
  it("accepts canonical UUIDs for service checkout context", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        service: "d1000000-0000-4000-8000-000000000001",
        slot: "2026-08-04T22:40:00.000Z",
      },
    });

    expect(context.serviceId).toBe("d1000000-0000-4000-8000-000000000001");
    expect(context.selectedSlot).toBe("2026-08-04T22:40:00.000Z");
    expect(context.hasRequiredCheckoutData).toBe(true);
  });

  it("does not convert marketing query data into required terms acceptance", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        marketing: "1",
        service: "d1000000-0000-4000-8000-000000000001",
        slot: "2026-08-04T22:40:00.000Z",
      },
    });

    expect(context.marketingConsent).toBe(true);
    expect(context.hasRequiredCheckoutData).toBe(true);
  });
});
