import { describe, expect, it } from "vitest";

import {
  applyPatientScheduleConflicts,
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

  it("hides patient conflicts and preserves an exactly consecutive slot", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        duration: "50",
        slot: "2026-08-29T21:30:00.000Z",
      },
    });
    const result = applyPatientScheduleConflicts({
      availabilityDays: [
        {
          date: "2026-08-29",
          dateLabel: "29/08",
          dayLabel: "Amanhã",
          slots: [
            {
              dateLabel: "29/08",
              dayLabel: "Amanhã",
              endsAt: "2026-08-29T22:20:00.000Z",
              serviceId: "d1000000-0000-4000-8000-000000000001",
              startsAt: "2026-08-29T21:30:00.000Z",
              timeLabel: "18:30",
            },
            {
              dateLabel: "29/08",
              dayLabel: "Amanhã",
              endsAt: "2026-08-29T23:10:00.000Z",
              serviceId: "d1000000-0000-4000-8000-000000000001",
              startsAt: "2026-08-29T22:20:00.000Z",
              timeLabel: "19:20",
            },
          ],
        },
      ],
      context,
      intervals: [
        {
          endsAt: "2026-08-29T22:20:00.000Z",
          startsAt: "2026-08-29T21:30:00.000Z",
        },
      ],
    });

    expect(result.availabilityDays[0]?.slots).toHaveLength(1);
    expect(result.availabilityDays[0]?.slots[0]?.timeLabel).toBe("19:20");
    expect(result.context.hiddenPatientConflictCount).toBe(1);
    expect(result.context.selectedSlotHasPatientConflict).toBe(true);
    expect(result.context.canPrepareEncounter).toBe(false);
  });
});
