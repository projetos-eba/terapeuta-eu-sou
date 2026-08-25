import { describe, expect, it } from "vitest";

import {
  buildReservationReturnHref,
  mergeReservationContextWithPublicProfile,
  resolveReservationContext,
} from "./reservation-data";

describe("public reservation data contract", () => {
  it("returns to the therapist public profile from the reservation flow", () => {
    expect(buildReservationReturnHref("ana-oliveira")).toBe(
      "/terapeutas/ana-oliveira",
    );
    expect(buildReservationReturnHref(null)).toBe("/terapeutas");
  });

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

  it("formats the reservation summary in the authoritative schedule timezone", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        duration: "60",
        slot: "2026-08-24T12:10:00.000Z",
      },
    });
    const hydrated = mergeReservationContextWithPublicProfile(context, {
      avatarUrl: null,
      headline: "Terapeuta",
      isVerified: true,
      name: "Brunna P",
      slug: "brunna-p",
      timezone: "America/Sao_Paulo",
    });

    expect(hydrated.time?.timeRangeLabel).toBe("09:10 - 10:10");
  });
});
