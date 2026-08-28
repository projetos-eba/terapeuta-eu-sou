import { describe, expect, it } from "vitest";

import {
  AttendanceSource,
  AttendanceStatus,
  BookingStatus,
  FulfillmentStatus,
  RescheduleStatus,
  SessionFinancialStatus,
  ZoomAccessReason,
  ZoomVideoSessionStatus,
} from "@/domain/tes";

import type { SessionReadModelItem } from "./session-read-model.types";
import {
  getSessionOperationDisabledReason,
  mapSessionPresentation,
} from "./session-presentation";

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

  it("makes video session the primary action only when backend access is allowed", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        zoomAccess: {
          allowed: true,
          availableFrom: "2026-07-26T12:45:00.000Z",
          availableUntil: "2026-07-26T14:30:00.000Z",
          videoSessionStatus: ZoomVideoSessionStatus.Ready,
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

  it("does not allow a cancelled booking to access the video session", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        bookingStatus: BookingStatus.CancelledByPatient,
        zoomAccess: {
          allowed: false,
          availableFrom: "2026-07-26T12:45:00.000Z",
          availableUntil: "2026-07-26T14:30:00.000Z",
          videoSessionStatus: ZoomVideoSessionStatus.Canceled,
          reason: ZoomAccessReason.BookingCancelled,
        },
      }),
      now,
    );

    expect(result.state).toBe("cancelled");
    expect(result.actions.canAccessZoom).toBe(false);
    expect(result.actions.canCancel).toBe(false);
  });

  it.each([
    SessionFinancialStatus.Canceled,
    SessionFinancialStatus.PartiallyRefunded,
    SessionFinancialStatus.Refunded,
  ])(
    "blocks repeat operations for closed payment state %s",
    (financialStatus) => {
      const session = sessionFixture({ financialStatus });
      const result = mapSessionPresentation(session, now);

      expect(result.actions.canCancel).toBe(false);
      expect(result.actions.canReschedule).toBe(false);
      expect(getSessionOperationDisabledReason(session, "cancel")).toContain(
        financialStatus === SessionFinancialStatus.Canceled
          ? "pagamento foi cancelado"
          : "pagamento já foi reembolsado",
      );
    },
  );

  it("blocks cancellation after a session was not performed", () => {
    const session = sessionFixture({
      fulfillmentStatus: FulfillmentStatus.NotPerformed,
    });
    const result = mapSessionPresentation(session, now);

    expect(result.actions.canCancel).toBe(false);
    expect(result.actions.canReschedule).toBe(false);
    expect(getSessionOperationDisabledReason(session, "cancel")).toContain(
      "já foi encerrada",
    );
  });

  it("identifies a paid session whose video session is still being prepared", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        videoSessionStatus: null,
        zoomAccess: {
          allowed: false,
          availableFrom: "2026-07-26T12:45:00.000Z",
          availableUntil: "2026-07-26T14:30:00.000Z",
          videoSessionStatus: "not_available",
          reason: ZoomAccessReason.VideoSessionNotReady,
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

  it("treats bilateral confirmation as a completed session", () => {
    const result = mapSessionPresentation(
      sessionFixture({
        bookingStatus: BookingStatus.Completed,
        endsAt: "2026-07-26T12:00:00.000Z",
        fulfillmentStatus: FulfillmentStatus.ConfirmedBilateral,
        startsAt: "2026-07-26T11:00:00.000Z",
      }),
      now,
    );

    expect(result.state).toBe("completed");
    expect(result.label).toBe("Realizada");
    expect(result.actions.canComplete).toBe(false);
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
    videoSessionProvider: "zoom_video_sdk",
    videoSessionStatus: ZoomVideoSessionStatus.Ready,
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
      videoSessionStatus: ZoomVideoSessionStatus.Ready,
      reason: ZoomAccessReason.TooEarly,
    },
    ...overrides,
  };
}
