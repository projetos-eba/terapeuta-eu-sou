import { describe, expect, it } from "vitest";

import {
  parseTherapistAgendaReadModel,
  parseTherapistSessionDetailReadModel,
  parseTherapistPendingConfirmationsSummary,
  SessionReadModelContractError,
} from "./session-read-model.parsers";

describe("parseTherapistAgendaReadModel", () => {
  it("requires every weekly rule to identify its therapy", () => {
    expect(() =>
      parseTherapistAgendaReadModel(
        agendaPayload({
          dayOfWeek: 1,
          endTime: "17:00:00",
          id: "rule-1",
          isActive: true,
          serviceId: null,
          startTime: "09:00:00",
          timezone: "America/Sao_Paulo",
        }),
      ),
    ).toThrow(SessionReadModelContractError);
  });

  it("keeps therapist-global availability exceptions valid", () => {
    const parsed = parseTherapistAgendaReadModel(
      agendaPayload({
        dayOfWeek: 1,
        endTime: "17:00:00",
        id: "rule-1",
        isActive: true,
        serviceId: "service-1",
        startTime: "09:00:00",
        timezone: "America/Sao_Paulo",
      }),
    );

    expect(parsed.availability.rules[0]?.serviceId).toBe("service-1");
    expect(parsed.availability.exceptions[0]?.serviceId).toBeNull();
  });
});

describe("parseTherapistPendingConfirmationsSummary", () => {
  it("keeps the pending count consistent with the returned booking ids", () => {
    expect(
      parseTherapistPendingConfirmationsSummary({
        generatedAt: "2026-09-03T12:00:00.000Z",
        pendingBookingIds: ["booking-1", "booking-2"],
        pendingSessions: [
          { bookingId: "booking-1", sessionReference: "26S000001" },
          { bookingId: "booking-2", sessionReference: "26S000002" },
        ],
        pendingCount: 2,
        therapistProfileId: "therapist-1",
        version: 1,
      }),
    ).toMatchObject({
      pendingBookingIds: ["booking-1", "booking-2"],
      pendingSessions: [
        { bookingId: "booking-1", sessionReference: "26S000001" },
        { bookingId: "booking-2", sessionReference: "26S000002" },
      ],
      pendingCount: 2,
      version: 1,
    });
  });

  it("rejects a count that does not match the booking ids", () => {
    expect(() =>
      parseTherapistPendingConfirmationsSummary({
        generatedAt: "2026-09-03T12:00:00.000Z",
        pendingBookingIds: ["booking-1"],
        pendingSessions: [
          { bookingId: "booking-1", sessionReference: "26S000001" },
        ],
        pendingCount: 2,
        therapistProfileId: "therapist-1",
        version: 1,
      }),
    ).toThrow(SessionReadModelContractError);
  });

  it("rejects a pending session reference paired with another booking", () => {
    expect(() =>
      parseTherapistPendingConfirmationsSummary({
        generatedAt: "2026-09-03T12:00:00.000Z",
        pendingBookingIds: ["booking-1"],
        pendingSessions: [
          { bookingId: "booking-2", sessionReference: "26S000001" },
        ],
        pendingCount: 1,
        therapistProfileId: "therapist-1",
        version: 1,
      }),
    ).toThrow(SessionReadModelContractError);
  });
});

describe("parseTherapistSessionDetailReadModel", () => {
  it("accepts the optional booking note without adding it to session lists", () => {
    const parsed = parseTherapistSessionDetailReadModel(
      therapistDetailPayload({ sharedNote: "Quero chegar com calma." }),
    );

    expect(parsed.sharedNote).toBe("Quero chegar com calma.");
  });

  it("keeps older detail payloads compatible when the note is absent", () => {
    const parsed = parseTherapistSessionDetailReadModel(
      therapistDetailPayload(),
    );

    expect(parsed.sharedNote).toBeNull();
  });
});

function therapistDetailPayload(overrides: Record<string, unknown> = {}) {
  return {
    attendanceSource: "unavailable",
    attendanceStatus: "pending",
    bookingId: "booking-1",
    bookingStatus: "confirmed",
    bookingVersion: 1,
    cancellationDecision: null,
    cancellationRequiresReview: null,
    currency: "BRL",
    durationMinutes: 60,
    endsAt: "2026-09-18T15:00:00.000Z",
    financialStatus: "paid",
    fulfillmentStatus: "scheduled",
    grossAmountCents: 12000,
    modality: "online",
    patientAvatarUrl: null,
    patientName: "Pessoa atendida",
    patientProfileId: "patient-1",
    priceCents: 12000,
    proposedEndsAt: null,
    proposedStartsAt: null,
    proposedTimezone: null,
    refundPending: null,
    rescheduleStatus: null,
    serviceId: "service-1",
    serviceTitle: "Reiki",
    sessionReference: "26S000001",
    startsAt: "2026-09-18T14:00:00.000Z",
    therapistAmountCents: 10200,
    therapistProfileId: "therapist-1",
    timezone: "America/Sao_Paulo",
    transferStatus: null,
    version: 1,
    videoSessionProvider: "zoom_video_sdk",
    videoSessionStatus: "ready",
    zoomAccess: {
      allowed: true,
      availableFrom: "2026-09-18T13:45:00.000Z",
      availableUntil: "2026-09-18T15:30:00.000Z",
      hardEndsAt: null,
      reason: null,
      scheduledEndsAt: "2026-09-18T15:00:00.000Z",
      scheduledStartsAt: "2026-09-18T14:00:00.000Z",
      serverNow: "2026-09-18T14:00:00.000Z",
      videoSessionStatus: "ready",
    },
    ...overrides,
  };
}

function agendaPayload(rule: Record<string, unknown>) {
  return {
    availability: {
      exceptions: [
        {
          endsAt: "2026-09-01T13:00:00.000Z",
          id: "exception-1",
          isAvailable: false,
          serviceId: null,
          startsAt: "2026-09-01T12:00:00.000Z",
        },
      ],
      rules: [rule],
    },
    bookings: [],
    holds: [],
    range: {
      end: "2026-09-08T00:00:00.000Z",
      endExclusive: true,
      start: "2026-09-01T00:00:00.000Z",
    },
    summary: {
      activeHolds: 0,
      bookings: 0,
      pendingReschedules: 0,
    },
    therapistProfileId: "therapist-1",
    timezone: "America/Sao_Paulo",
    version: 1,
  };
}
