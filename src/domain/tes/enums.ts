export const UserRole = {
  Patient: "patient",
  Therapist: "therapist",
  Admin: "admin",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TherapistPlan = {
  Free: "free",
  Premium: "premium",
  PremiumPlus: "premium_plus",
} as const;

export type TherapistPlan = (typeof TherapistPlan)[keyof typeof TherapistPlan];

export const TherapistStatus = {
  Draft: "draft",
  Submitted: "submitted",
  InReview: "in_review",
  ChangesRequested: "changes_requested",
  Approved: "approved",
  Rejected: "rejected",
  Suspended: "suspended",
} as const;

export type TherapistStatus =
  (typeof TherapistStatus)[keyof typeof TherapistStatus];

export const TherapyStatus = {
  Draft: "draft",
  Active: "active",
  InReview: "in_review",
  Published: "published",
  Deprecated: "deprecated",
  Inactive: "inactive",
  Archived: "archived",
} as const;

export type TherapyStatus = (typeof TherapyStatus)[keyof typeof TherapyStatus];

export const ServiceStatus = {
  Draft: "draft",
  Active: "active",
  Paused: "paused",
  RequiresReview: "requires_review",
  Rejected: "rejected",
  Archived: "archived",
} as const;

export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];

export const BookingStatus = {
  Draft: "draft",
  PendingPayment: "pending_payment",
  Confirmed: "confirmed",
  Completed: "completed",
  CancelledByPatient: "cancelled_by_patient",
  CancelledByTherapist: "cancelled_by_therapist",
  NoShowPatient: "no_show_patient",
  NoShowTherapist: "no_show_therapist",
  CancelledByPayment: "cancelled_by_payment",
  Refunded: "refunded",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const PaymentStatus = {
  NotStarted: "not_started",
  Pending: "pending",
  Paid: "paid",
  Failed: "failed",
  Refunded: "refunded",
  PartiallyRefunded: "partially_refunded",
  Cancelled: "cancelled",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const MatchSource = {
  Journey: "journey",
  TherapyPage: "therapy_page",
  TherapistSearch: "therapist_search",
} as const;

export type MatchSource = (typeof MatchSource)[keyof typeof MatchSource];

export const MessageContext = {
  PatientToTherapist: "patient_to_therapist",
  PatientToSupport: "patient_to_support",
  TherapistToPatient: "therapist_to_patient",
  System: "system",
} as const;

export type MessageContext =
  (typeof MessageContext)[keyof typeof MessageContext];

export const ReviewStatus = {
  Pending: "pending",
  Published: "published",
  Hidden: "hidden",
  Reported: "reported",
  Removed: "removed",
} as const;

export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];
