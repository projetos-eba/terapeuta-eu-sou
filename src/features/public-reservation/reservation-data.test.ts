import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyPatientScheduleConflicts,
  buildReservationSchedule,
  buildReservationReturnHref,
  mergeReservationContextWithPublicProfile,
  resolveReservationContext,
} from "./reservation-data";

describe("public reservation data contract", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("keeps patient conflicts visible and preserves an exactly consecutive slot", () => {
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        duration: "50",
        slot: "2026-09-03T21:30:00.000Z",
      },
    });
    const result = applyPatientScheduleConflicts({
      availabilityDays: [
        {
          date: "2026-09-03",
          dateLabel: "03/09",
          dayLabel: "Amanhã",
          slots: [
            {
              dateLabel: "03/09",
              dayLabel: "Amanhã",
              endsAt: "2026-09-03T22:20:00.000Z",
              serviceId: "d1000000-0000-4000-8000-000000000001",
              startsAt: "2026-09-03T21:30:00.000Z",
              timeLabel: "18:30",
            },
            {
              dateLabel: "03/09",
              dayLabel: "Amanhã",
              endsAt: "2026-09-03T23:10:00.000Z",
              serviceId: "d1000000-0000-4000-8000-000000000001",
              startsAt: "2026-09-03T22:20:00.000Z",
              timeLabel: "19:20",
            },
          ],
        },
      ],
      context,
      intervals: [
        {
          endsAt: "2026-09-03T22:20:00.000Z",
          startsAt: "2026-09-03T21:30:00.000Z",
        },
      ],
    });

    expect(result.availabilityDays[0]?.slots).toHaveLength(2);
    const schedule = buildReservationSchedule(
      result.context,
      result.availabilityDays,
    );
    const slots = schedule.days.flatMap((day) => day.slots);
    expect(slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hasPatientConflict: true,
          timeLabel: "18:30",
        }),
        expect.objectContaining({
          hasPatientConflict: false,
          timeLabel: "19:20",
        }),
      ]),
    );
    expect(result.context.selectedSlotHasPatientConflict).toBe(true);
    expect(result.context.canPrepareEncounter).toBe(false);
  });

  it("starts the five-day window on the selected slot in the schedule timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00.000Z"));
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        service: "d1000000-0000-4000-8000-000000000001",
        slot: "2026-09-30T02:30:00.000Z",
      },
      timezone: "America/Sao_Paulo",
    });

    const schedule = buildReservationSchedule(context);

    expect(schedule.days).toHaveLength(5);
    expect(schedule.days.map((day) => day.dateKey)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("prioritizes explicit navigation date and moves exactly five days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00.000Z"));
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: {
        date: "2026-12-29",
        duration: "20",
        etapa: "momento",
        service: "d1000000-0000-4000-8000-000000000001",
        source: "profile",
        therapist: "ana-oliveira",
      },
    });

    const schedule = buildReservationSchedule(context, [
      {
        date: "2027-01-10",
        dateLabel: "10/01",
        dayLabel: "Dom",
        slots: [],
      },
    ]);

    expect(schedule.days[0]?.dateKey).toBe("2026-12-29");
    expect(schedule.nextHref).toContain("date=2027-01-03");
    expect(schedule.previousHref).toContain("date=2026-12-24");
    expect(schedule.nextHref).not.toContain("slot=");
    expect(schedule.nextHref).toContain("source=profile");
    expect(schedule.nextHref).toContain("etapa=momento");
  });

  it("uses the first available day when there is no selection or navigation date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00.000Z"));
    const context = resolveReservationContext({ isPatientAuthenticated: true });
    const schedule = buildReservationSchedule(context, [
      {
        date: "2026-10-31",
        dateLabel: "31/10",
        dayLabel: "Sáb",
        slots: [
          {
            dateLabel: "31/10",
            dayLabel: "Sáb",
            endsAt: "2026-10-31T13:20:00.000Z",
            serviceId: "d1000000-0000-4000-8000-000000000001",
            startsAt: "2026-10-31T13:00:00.000Z",
            timeLabel: "10:00",
          },
        ],
      },
    ]);

    expect(schedule.days[0]?.dateKey).toBe("2026-10-31");
    expect(schedule.days[0]?.slots[0]?.timeLabel).toBe("10:00");
  });

  it("blocks a five-day backward jump that would begin before today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00.000Z"));
    const context = resolveReservationContext({
      isPatientAuthenticated: true,
      searchParams: { date: "2026-09-07" },
    });

    expect(buildReservationSchedule(context).previousHref).toBeNull();
  });
});
