import type { BookingStatus, PaymentStatus } from "./enums";
import { BookingStatus as BookingStatusValue } from "./enums";
import type { CurrencyCode, ISODateTimeString, UUID } from "./types";

export const FulfillmentStatus = {
  AutoConfirmed: "auto_confirmed",
  Cancelled: "canceled",
  ConfirmedByPatientReview: "confirmed_by_patient_review",
  ConfirmedByTherapist: "confirmed_by_therapist",
  Contested: "contested",
  NotPerformed: "not_performed",
  OccurredPendingConfirmation: "occurred_pending_confirmation",
  Scheduled: "scheduled",
} as const;

export type FulfillmentStatus =
  (typeof FulfillmentStatus)[keyof typeof FulfillmentStatus];

export const AttendanceStatus = {
  Attended: "attended",
  PatientNoShow: "patient_no_show",
  Pending: "pending",
  TherapistNoShow: "therapist_no_show",
} as const;

export type AttendanceStatus =
  (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const RescheduleStatus = {
  Accepted: "accepted",
  Applied: "applied",
  Cancelled: "cancelled",
  Expired: "expired",
  Pending: "pending",
  Rejected: "rejected",
} as const;

export type RescheduleStatus =
  (typeof RescheduleStatus)[keyof typeof RescheduleStatus];

export const CancellationStatus = {
  FreeCancellationFullRefund: "free_cancellation_full_refund",
  LateCancellationPartialRefund: "late_cancellation_partial_refund",
  ManualReviewRequired: "manual_review_required",
  NoShowRetention: "no_show_retention",
  TherapistCancellationFullRefund: "therapist_cancellation_full_refund",
} as const;

export type CancellationStatus =
  (typeof CancellationStatus)[keyof typeof CancellationStatus];

export type PersonSummary = {
  avatarUrl: string | null;
  displayName: string;
  id: UUID;
};

export type ServiceSummary = {
  durationMinutes: number;
  id: UUID;
  title: string;
};

export type BookingServiceSnapshot = {
  bufferAfterMinutes: number;
  bufferBeforeMinutes: number;
  capturedAt: ISODateTimeString;
  currency: CurrencyCode;
  durationMinutes: number;
  priceCents: number;
  serviceId: UUID;
  title: string;
};

export type BookingTransitionRequest = {
  actorProfileId: UUID | null;
  bookingId: UUID;
  expectedVersion?: number;
  reason?: string;
  requestId: string;
  source: "admin" | "agenda_a2" | "system";
  targetStatus: BookingStatus;
};

export type SharedBookingSummary = {
  bookingId: UUID;
  bookingStatus: BookingStatus;
  endsAt: ISODateTimeString;
  fulfillmentStatus: FulfillmentStatus;
  modality: "in_person" | "online";
  patient: PersonSummary;
  paymentStatus: PaymentStatus;
  service: ServiceSummary;
  startsAt: ISODateTimeString;
  therapist: PersonSummary;
  timezone: string;
  version?: number;
};

export type PatientBookingSummary = SharedBookingSummary & {
  availableActions: Array<
    "cancel" | "join" | "pay" | "rate" | "request_reschedule" | "view_receipt"
  >;
};

export type TherapistBookingSummary = SharedBookingSummary & {
  attendanceStatus: AttendanceStatus;
  availableActions: Array<
    "confirm_fulfillment" | "join" | "request_reschedule" | "view_financial"
  >;
};

const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatusValue.Draft]: [
    BookingStatusValue.PendingPayment,
    BookingStatusValue.CancelledByPatient,
  ],
  [BookingStatusValue.PendingPayment]: [
    BookingStatusValue.Confirmed,
    BookingStatusValue.CancelledByPatient,
    BookingStatusValue.Refunded,
  ],
  [BookingStatusValue.Confirmed]: [
    BookingStatusValue.Completed,
    BookingStatusValue.CancelledByPatient,
    BookingStatusValue.CancelledByTherapist,
    BookingStatusValue.NoShowPatient,
    BookingStatusValue.NoShowTherapist,
    BookingStatusValue.Refunded,
  ],
  [BookingStatusValue.Completed]: [BookingStatusValue.Refunded],
  [BookingStatusValue.CancelledByPatient]: [BookingStatusValue.Refunded],
  [BookingStatusValue.CancelledByTherapist]: [BookingStatusValue.Refunded],
  [BookingStatusValue.NoShowPatient]: [BookingStatusValue.Refunded],
  [BookingStatusValue.NoShowTherapist]: [BookingStatusValue.Refunded],
  [BookingStatusValue.Refunded]: [],
};

export function isBookingStatus(value: string): value is BookingStatus {
  return Object.values(BookingStatusValue).includes(value as BookingStatus);
}

export function canTransitionBookingStatus(
  current: BookingStatus,
  next: BookingStatus,
) {
  return bookingTransitions[current].includes(next);
}
