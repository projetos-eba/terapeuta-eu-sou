import type { ComponentProps } from "react";
import type { TherapistSessionDetailReadModel } from "@/features/bookings";
import {
  BookingStatus,
  FulfillmentStatus,
  SessionFinancialStatus,
  AttendanceSource,
  AttendanceStatus,
  ZoomAccessReason,
  ZoomVideoSessionStatus,
} from "@/domain/tes";
export { getTherapistSessionPaymentStatus } from "@/features/therapist-sessions/session-payment-status";

// Only server/auth boundaries are simulated. No credentials or external writes.
export const therapistRoutePolicies = { sessions: {} };
export async function requireTherapistSession() {
  return {
    accessToken: "isolated-fixture",
    profileId: "fixture",
    userId: "fixture",
    plan: "free",
  };
}
export async function getTherapistSessionDetail() {
  const booking: TherapistSessionDetailReadModel = {
    attendanceSource: AttendanceSource.Unavailable,
    attendanceStatus: AttendanceStatus.Pending,
    bookingId: "f2000000-0000-4000-8000-000000000002",
    sessionReference: "26S000133",
    bookingStatus: BookingStatus.NoShowTherapist,
    bookingVersion: 2,
    cancellationDecision: null,
    cancellationRequiresReview: false,
    currency: "BRL",
    durationMinutes: 20,
    startsAt: "2026-09-16T21:00:00Z",
    endsAt: "2026-09-16T21:20:00Z",
    financialStatus: SessionFinancialStatus.Paid,
    fulfillmentStatus: FulfillmentStatus.NotPerformed,
    grossAmountCents: 15000,
    videoSessionProvider: "zoom_video_sdk",
    videoSessionStatus: ZoomVideoSessionStatus.Ready,
    modality: "online",
    patientAvatarUrl: null,
    patientName: "Cliente de teste",
    patientProfileId: "fixture",
    priceCents: 15000,
    proposedEndsAt: null,
    proposedStartsAt: null,
    proposedTimezone: null,
    refundPending: false,
    rescheduleStatus: null,
    serviceId: "fixture",
    serviceTitle: "Reiki online",
    therapistAmountCents: 12750,
    therapistProfileId: "fixture",
    timezone: "America/Sao_Paulo",
    transferStatus: "blocked",
    version: 1,
    zoomAccess: {
      allowed: false,
      availableFrom: "2026-09-16T20:45:00Z",
      availableUntil: "2026-09-16T21:10:00Z",
      videoSessionStatus: ZoomVideoSessionStatus.Ready,
      reason: ZoomAccessReason.TherapistArrivalWindowExpired,
    },
  };
  return { status: "success" as const, data: booking };
}
export async function getTherapistSessionFeedbackSummary() {
  return { status: "incident_only", feedback: null };
}
export async function getTherapistSessionPendingReschedule() {
  return null;
}
export async function getSessionDelayNoticeState() {
  return { participantJoined: false, sentAt: null };
}
export function shouldShowTherapistSessionJourneyThemes() {
  return false;
}
export function useRouter() {
  return { refresh() {}, push() {}, replace() {} };
}
export function usePathname() {
  return "/isolated-attendance";
}
export function notFound() {
  throw new Error("isolated fixture missing");
}
export default function Link(props: ComponentProps<"a">) {
  return <a {...props} />;
}
