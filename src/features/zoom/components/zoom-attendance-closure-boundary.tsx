"use client";

import { useEffect, useState, type ReactNode } from "react";

import { getSupportWhatsAppHref } from "@/lib/support-whatsapp";

import { ZoomWaitingRoom } from "./zoom-waiting-room";

type AttendanceResponse = {
  ok?: boolean;
  data?: {
    contractVersion?: number;
    realizationStatus?: string;
    attendance?: {
      sessionStartsAt?: string;
      classification?: string;
      therapistPresentAtTolerance?: boolean;
      patientPresentAtTolerance?: boolean;
      bothJoined?: boolean;
      sessionClosed?: boolean;
    };
  };
};

// Attendance is decided by the server, never by an empty SDK roster or a
// browser timer. A timely patient arrival keeps the existing reentry flow.
export function ZoomAttendanceClosureBoundary({
  actorRole,
  bookingId,
  children,
  participantLabel,
  scheduleLabel,
  scheduledStartsAt,
  showFeedback,
}: {
  actorRole: "patient" | "therapist";
  bookingId: string;
  children: ReactNode;
  participantLabel: string;
  scheduleLabel: string;
  scheduledStartsAt: string;
  showFeedback: boolean;
}) {
  const [patientAbsent, setPatientAbsent] = useState(false);

  useEffect(() => {
    setPatientAbsent(false);
    if (actorRole !== "therapist" || showFeedback) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      let keepPolling = true;
      try {
        const response = await fetch(
          `/api/session-feedback?bookingId=${encodeURIComponent(bookingId)}&actorRole=therapist`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload: AttendanceResponse = await response.json();
        if (controller.signal.aborted) return;
        const data = payload.data;
        const attendance = data?.attendance;
        if (
          response.ok &&
          payload.ok &&
          data?.contractVersion === 2 &&
          attendance &&
          Date.parse(attendance.sessionStartsAt ?? "") ===
            Date.parse(scheduledStartsAt)
        ) {
          if (
            data.realizationStatus === "not_performed" &&
            attendance.classification === "no_show_patient" &&
            attendance.therapistPresentAtTolerance === true &&
            attendance.patientPresentAtTolerance === false
          ) {
            setPatientAbsent(true);
            keepPolling = false;
          } else if (
            attendance.patientPresentAtTolerance === true ||
            attendance.bothJoined === true ||
            attendance.sessionClosed === true
          ) {
            keepPolling = false;
          }
        }
      } catch {
        // A failed observation must not interrupt the existing video call.
      }
      if (!controller.signal.aborted && keepPolling) {
        timer = setTimeout(() => void refresh(), 15_000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [actorRole, bookingId, scheduledStartsAt, showFeedback]);

  if (!patientAbsent) return children;

  return (
    <ZoomWaitingRoom
      actorRole="therapist"
      bookingId={bookingId}
      isOnline
      kind="patient_no_show"
      onJoin={() => undefined}
      onRefresh={() => window.location.reload()}
      participantLabel={participantLabel}
      previewLoading={false}
      scheduleLabel={scheduleLabel}
      supportHref={getSupportWhatsAppHref("waiting_room", bookingId)}
    />
  );
}
