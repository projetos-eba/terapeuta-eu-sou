import { describe, expect, it } from "vitest";

import {
  AttendanceSource,
  AttendanceStatus,
  BookingStatus,
  FulfillmentStatus,
  RescheduleStatus,
  SessionFinancialStatus,
  ZoomAccessReason,
  ZoomMeetingStatus,
} from "@/domain/tes";

import type { SessionReadModelItem } from "./session-read-model.types";
import { mapSessionPresentation } from "./session-presentation";

const now = new Date("2026-07-26T13:00:00.000Z");

describe("mapSessionPresentation", () => {
  it("uses canonical payment state even when the booking is confirmed", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        bookingStatus: BookingStatus.Confirmed,
        financialStatus: SessionFinancialStatus.Pending,
      }),
      now,
    );

    expect(result.state).toBe("payment_pending");
    expect(result.actions.canAccessZoom).toBe(false);
  });

  it("makes Zoom the primary action only when backend access is allowed", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        zoomAccess: {
          allowed: true,
          availableFrom: "2026-07-26T12:45:00.000Z",
          availableUntil: "2026-07-26T14:30:00.000Z",
          meetingStatus: ZoomMeetingStatus.Provisioned,
          reason: null,
        },
      }),
      now,
    );

    expect(result.state).toBe("ready");
    expect(result.actions.primary).toEqual({
      action: "join_zoom",
      label: "Entrar na sessão",
    });
  });

  it("prioritizes a pending reschedule over regular session actions", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        proposedEndsAt: "2026-07-28T14:00:00.000Z",
        proposedStartsAt: "2026-07-28T13:00:00.000Z",
        rescheduleStatus: RescheduleStatus.Pending,
      }),
      now,
    );

    expect(result.state).toBe("reschedule_requested");
    expect(result.actions.primary.action).toBe("review_reschedule");
    expect(result.actions.canReschedule).toBe(false);
  });

  it("does not allow a cancelled booking to access Zoom", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        bookingStatus: BookingStatus.CancelledByPatient,
        zoomAccess: {
          allowed: false,
          availableFrom: "2026-07-26T12:45:00.000Z",
          availableUntil: "2026-07-26T14:30:00.000Z",
          meetingStatus: ZoomMeetingStatus.Canceled,
          reason: ZoomAccessReason.BookingCancelled,
        },
      }),
      now,
    );

    expect(result.state).toBe("cancelled");
    expect(result.actions.canAccessZoom).toBe(false);
    expect(result.actions.canCancel).toBe(false);
  });

  it("identifies a paid session whose room is still being provisioned", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        meetingStatus: ZoomMeetingStatus.PendingProvisioning,
        zoomAccess: {
          allowed: false,
          availableFrom: "2026-07-26T12:45:00.000Z",
          availableUntil: "2026-07-26T14:30:00.000Z",
          meetingStatus: ZoomMeetingStatus.PendingProvisioning,
          reason: ZoomAccessReason.MeetingNotReady,
        },
      }),
      now,
    );

    expect(result.state).toBe("room_preparing");
    expect(result.actions.primary.action).toBe("view_detail");
  });

  it("maps fulfillment completion independently from booking payment", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        bookingStatus: BookingStatus.Completed,
        endsAt: "2026-07-26T12:00:00.000Z",
        fulfillmentStatus: FulfillmentStatus.ConfirmedByTherapist,
        startsAt: "2026-07-26T11:00:00.000Z",
      }),
      now,
    );

    expect(result.state).toBe("completed");
    expect(result.label).toBe("Realizada");
  });
});

function sessionFixture(
  overrides: Partial<SessionReadModelItem> = {},
): SessionReadModelItem {
  return {
    attendanceSource: AttendanceSource.Unavailable,
    attendanceStatus: AttendanceStatus.Pending,
    bookingId: "f2000000-0000-4000-8000-000000000001",
    bookingStatus: BookingStatus.Confirmed,
    bookingVersion: 1,
    cancellationDecision: null,
    cancellationRequiresReview: false,
    currency: "BRL",
    durationMinutes: 60,
    endsAt: "2026-07-26T14:00:00.000Z",
    financialStatus: SessionFinancialStatus.Paid,
    fulfillmentStatus: FulfillmentStatus.Scheduled,
    grossAmountCents: 15000,
    meetingProvider: "zoom",
    meetingStatus: ZoomMeetingStatus.Provisioned,
    modality: "online",
    patientAvatarUrl: null,
    patientName: "Paciente",
    patientProfileId: "b1000000-0000-4000-8000-000000000001",
    priceCents: 15000,
    proposedEndsAt: null,
    proposedStartsAt: null,
    proposedTimezone: null,
    refundPending: false,
    rescheduleStatus: null,
    serviceId: "d1000000-0000-4000-8000-000000000001",
    serviceTitle: "Sessão integrativa",
    startsAt: "2026-07-26T13:00:00.000Z",
    therapistAmountCents: 12000,
    timezone: "America/Sao_Paulo",
    transferStatus: "not_scheduled",
    zoomAccess: {
      allowed: false,
      availableFrom: "2026-07-26T12:45:00.000Z",
      availableUntil: "2026-07-26T14:30:00.000Z",
      meetingStatus: ZoomMeetingStatus.Provisioned,
      reason: ZoomAccessReason.TooEarly,
    },
    ...overrides,
  };
}
