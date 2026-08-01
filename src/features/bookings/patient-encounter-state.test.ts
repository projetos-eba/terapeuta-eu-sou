import { describe, expect, it } from "vitest";

import {
  BookingStatus,
  SessionFinancialStatus,
  ZoomAccessReason,
  ZoomVideoSessionStatus,
} from "@/domain/tes";

import { getPatientEncounterPresentationState } from "./patient-encounter-state";

const baseInput = {
  bookingStatus: BookingStatus.Confirmed,
  endsAt: "2026-08-01T15:00:00.000Z",
  provider: "zoom" as const,
  startsAt: "2026-08-01T14:00:00.000Z",
};

describe("getPatientEncounterPresentationState", () => {
  it("allows a paid patient to see the Zoom entry state inside the join window", () => {
    const state = getPatientEncounterPresentationState({
      ...baseInput,
      financialStatus: SessionFinancialStatus.Paid,
      now: new Date("2026-08-01T13:50:00.000Z"),
      zoomAccess: {
        allowed: true,
        availableFrom: "2026-08-01T13:45:00.000Z",
        availableUntil: "2026-08-01T15:30:00.000Z",
        reason: null,
        videoSessionStatus: ZoomVideoSessionStatus.Active,
      },
    });

    expect(state.payment.kind).toBe("confirmed");
    expect(state.payment.slotState).toBe("confirmed");
    expect(state.waitingRoom.kind).toBe("therapist_present");
    expect(state.actions).toEqual(
      expect.arrayContaining(["join_zoom", "test_devices"]),
    );
  });

  it("keeps a processing payment distinct from a confirmed payment", () => {
    const state = getPatientEncounterPresentationState({
      ...baseInput,
      financialStatus: SessionFinancialStatus.Processing,
      now: new Date("2026-08-01T13:40:00.000Z"),
    });

    expect(state.payment.kind).toBe("processing");
    expect(state.payment.retryAllowed).toBe(false);
    expect(state.waitingRoom.kind).toBe("payment_required");
    expect(state.actions).toEqual(["contact_support"]);
  });

  it("marks pending payment as awaiting webhook before start and expired after start", () => {
    const waitingWebhook = getPatientEncounterPresentationState({
      ...baseInput,
      financialStatus: SessionFinancialStatus.Pending,
      now: new Date("2026-08-01T13:30:00.000Z"),
    });
    const expired = getPatientEncounterPresentationState({
      ...baseInput,
      financialStatus: SessionFinancialStatus.Pending,
      now: new Date("2026-08-01T14:05:00.000Z"),
    });

    expect(waitingWebhook.payment.kind).toBe("awaiting_webhook");
    expect(waitingWebhook.payment.slotState).toBe("review");
    expect(expired.payment.kind).toBe("expired");
    expect(expired.payment.slotState).toBe("released");
  });

  it("blocks Zoom access for failed payments and exposes retry only before start", () => {
    const state = getPatientEncounterPresentationState({
      ...baseInput,
      financialStatus: SessionFinancialStatus.Failed,
      now: new Date("2026-08-01T13:40:00.000Z"),
    });

    expect(state.payment.kind).toBe("failed");
    expect(state.payment.retryAllowed).toBe(true);
    expect(state.waitingRoom.kind).toBe("payment_required");
    expect(state.actions).toEqual(
      expect.arrayContaining(["retry_payment", "contact_support"]),
    );
  });

  it("shows waiting room and prolonged absence without issuing a join action", () => {
    const waiting = getPatientEncounterPresentationState({
      ...baseInput,
      financialStatus: SessionFinancialStatus.Paid,
      now: new Date("2026-08-01T13:50:00.000Z"),
      zoomAccess: {
        allowed: false,
        availableFrom: "2026-08-01T13:45:00.000Z",
        availableUntil: "2026-08-01T15:30:00.000Z",
        reason: ZoomAccessReason.TherapistNotInSession,
        videoSessionStatus: ZoomVideoSessionStatus.Ready,
      },
    });
    const prolonged = getPatientEncounterPresentationState({
      ...baseInput,
      financialStatus: SessionFinancialStatus.Paid,
      now: new Date("2026-08-01T14:12:00.000Z"),
      zoomAccess: {
        allowed: false,
        availableFrom: "2026-08-01T13:45:00.000Z",
        availableUntil: "2026-08-01T15:30:00.000Z",
        reason: ZoomAccessReason.TherapistNotInSession,
        videoSessionStatus: ZoomVideoSessionStatus.Ready,
      },
    });

    expect(waiting.waitingRoom.kind).toBe("waiting_therapist");
    expect(waiting.actions).not.toContain("join_zoom");
    expect(prolonged.waitingRoom.kind).toBe("therapist_absent_prolonged");
    expect(prolonged.actions).toEqual(
      expect.arrayContaining(["contact_support"]),
    );
  });

  it("ends the waiting room when Zoom reports a hard timeout", () => {
    const state = getPatientEncounterPresentationState({
      ...baseInput,
      financialStatus: SessionFinancialStatus.Paid,
      now: new Date("2026-08-01T15:40:00.000Z"),
      zoomAccess: {
        allowed: false,
        availableFrom: "2026-08-01T13:45:00.000Z",
        availableUntil: "2026-08-01T15:30:00.000Z",
        reason: ZoomAccessReason.HardTimeout,
        videoSessionStatus: ZoomVideoSessionStatus.Ended,
      },
    });

    expect(state.waitingRoom.kind).toBe("ended");
    expect(state.actions).not.toContain("join_zoom");
  });
});
