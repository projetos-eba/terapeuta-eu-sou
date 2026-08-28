import { describe, expect, it } from "vitest";

import { SessionReadModelContractError } from "@/features/bookings";

import { parseTherapistCalendarReadModel } from "./therapist-calendar.parsers";

describe("parseTherapistCalendarReadModel", () => {
  it("accepts the versioned calendar contract and canonical color keys", () => {
    const result = parseTherapistCalendarReadModel(calendarPayload());

    expect(result.contractVersion).toBe(1);
    expect(result.services[0]?.colorKey).toBe("purple");
    expect(result.bookings[0]?.therapyName).toBe("Reiki");
    expect(result.range.endExclusive).toBe(true);
  });

  it("rejects arbitrary CSS values as therapy colors", () => {
    const payload = calendarPayload();
    payload.services[0].colorKey = "#ff00ff";

    expect(() => parseTherapistCalendarReadModel(payload)).toThrow(
      SessionReadModelContractError,
    );
  });

  it("accepts the canonical bilateral fulfillment state", () => {
    const payload = calendarPayload();
    payload.bookings[0].fulfillmentStatus = "confirmed_bilateral";

    const result = parseTherapistCalendarReadModel(payload);

    expect(result.bookings[0]?.fulfillmentStatus).toBe(
      "confirmed_bilateral",
    );
  });
});

function calendarPayload() {
  return {
    anchorDate: "2026-07-27",
    attentionItems: [
      {
        booking_id: "f2000000-0000-4000-8000-000000000001",
        description: "Pediu reagendamento",
        id: "a5000000-0000-4000-8000-000000000001",
        kind: "reschedule",
        starts_at: "2026-07-27T12:00:00.000Z",
        title: "Paciente",
      },
    ],
    blocks: [],
    bookings: [
      {
        attendanceSource: "unavailable",
        attendanceStatus: "pending",
        bookingId: "f2000000-0000-4000-8000-000000000001",
        bookingStatus: "confirmed",
        bookingVersion: 1,
        cancellationDecision: null,
        cancellationRequiresReview: false,
        colorKey: "purple",
        currency: "BRL",
        durationMinutes: 50,
        endsAt: "2026-07-27T12:50:00.000Z",
        financialStatus: "paid",
        fulfillmentStatus: "scheduled",
        grossAmountCents: 17000,
        modality: "online",
        patientAvatarUrl: null,
        patientName: "Paciente",
        patientProfileId: "b1000000-0000-4000-8000-000000000001",
        priceCents: 17000,
        proposedEndsAt: null,
        proposedStartsAt: null,
        proposedTimezone: null,
        refundPending: false,
        rescheduleStatus: null,
        serviceId: "d1000000-0000-4000-8000-000000000001",
        serviceTitle: "Reiki",
        startsAt: "2026-07-27T12:00:00.000Z",
        therapistAmountCents: 14450,
        therapyId: "22222222-2222-4222-8222-222222222225",
        therapyName: "Reiki",
        timezone: "America/Sao_Paulo",
        transferStatus: "not_scheduled",
        videoSessionProvider: "zoom_video_sdk",
        videoSessionStatus: "ready",
        zoomAccess: {
          allowed: false,
          availableFrom: "2026-07-27T11:45:00.000Z",
          availableUntil: "2026-07-27T13:20:00.000Z",
          reason: "TOO_EARLY",
          videoSessionStatus: "ready",
        },
      },
    ],
    contractVersion: 1,
    demand: [{ count: 3, dayOfWeek: 1, hourBlock: 8 }],
    holds: [],
    range: {
      end: "2026-08-03T03:00:00.000Z",
      endExclusive: true,
      localEndExclusive: "2026-08-03",
      localStart: "2026-07-27",
      start: "2026-07-27T03:00:00.000Z",
    },
    services: [
      {
        colorKey: "purple",
        durationMinutes: 50,
        id: "d1000000-0000-4000-8000-000000000001",
        therapyId: "22222222-2222-4222-8222-222222222225",
        therapyName: "Reiki",
        title: "Reiki",
      },
    ],
    summary: { activeHolds: 0, bookings: 1, pendingAttention: 1 },
    therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    timezone: "America/Sao_Paulo",
    view: "week",
  };
}
