import {
  SessionFinancialStatus,
  type SessionFinancialStatus as SessionFinancialStatusValue,
} from "@/domain/tes";
import {
  getBookingDetailStatus,
  getBookingDetailStatusLabel,
} from "./booking-detail-status";
import {
  getPatientEncounterActionPolicy,
  getPatientEncounterPresentationState,
} from "@/features/bookings";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";
import {
  formatJourneyStartedAt,
  formatSessionDate,
  formatSessionDuration,
  formatSessionTimeRange,
  getMinutesUntilStart,
} from "./booking-detail-formatters";
import type {
  BookingDetailPageData,
  BookingDetailPerspective,
} from "./booking-detail.types";

export type BookingDetailBookingRow = {
  completed_at: string | null;
  currency_snapshot: string | null;
  ends_at: string;
  id: string;
  meeting_provider: string | null;
  patient_profile_id: string;
  service_duration_minutes_snapshot: number | null;
  service_id: string;
  service_price_cents_snapshot: number | null;
  service_title_snapshot: string | null;
  starts_at: string;
  status: string;
  therapist_profile_id: string;
  timezone: string;
  version: number;
};

export type BookingDetailProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  id: string;
};

export type BookingDetailPatientProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  id: string;
};

export type BookingDetailTherapistRow = {
  headline: string | null;
  id: string;
  is_accepting_bookings: boolean;
  photo_url: string | null;
  public_name: string;
  slug: string;
};

export type BookingDetailServiceRow = {
  currency: string;
  description: string | null;
  duration_minutes: number;
  id: string;
  price_cents: number;
  therapy_id: string | null;
  title: string;
};

export type BookingDetailTherapyRow = {
  id: string;
  name: string;
  slug: string;
};

export type BookingDetailReviewRow = {
  rating: number;
};

export type BookingDetailIntakeRow = {
  focus_area: string;
  shared_note: string;
  therapy_goal: string;
  visibility: "patient_therapist" | "private_patient" | "support" | string;
};

export type BookingDetailReceiptRow = {
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  receipt_url: string | null;
};

export type BookingDetailSessionPaymentRow = {
  id: string;
  refund_pending: boolean | null;
  financial_status: SessionFinancialStatusValue;
};

export type BookingDetailCancellationDecisionRow = {
  decision: string;
  refund_amount_cents: number;
  requires_manual_review: boolean;
  review_due_at: string | null;
};

export type BookingDetailCancellationPolicyRow = {
  free_until_hours: number;
  late_cancel_fee_percent: number;
  no_show_fee_percent: number;
};

export type BookingDetailSessionSummaryRow = {
  booking_id: string;
  created_at: string;
  summary: string | null;
  title: string | null;
};

export type BookingDetailRescheduleRow = {
  expires_at: string | null;
  id: string;
  proposed_ends_at: string;
  proposed_starts_at: string;
  proposed_timezone: string;
  reason: string | null;
  requested_by_profile_id: string;
  status: string;
};

export type MapBookingDetailInput = {
  booking: BookingDetailBookingRow;
  completedBookings: BookingDetailBookingRow[];
  intake: BookingDetailIntakeRow | null;
  patient: BookingDetailProfileRow;
  patientProfile: BookingDetailPatientProfileRow;
  perspective: BookingDetailPerspective;
  policy: BookingDetailCancellationPolicyRow | null;
  receipt: BookingDetailReceiptRow | null;
  reschedule: BookingDetailRescheduleRow | null;
  reviews: BookingDetailReviewRow[];
  cancellationDecision: BookingDetailCancellationDecisionRow | null;
  service: BookingDetailServiceRow;
  sessionPayment: BookingDetailSessionPaymentRow | null;
  summaries: BookingDetailSessionSummaryRow[];
  therapist: BookingDetailTherapistRow;
  therapy: BookingDetailTherapyRow;
};

export function mapBookingDetail(
  input: MapBookingDetailInput,
): BookingDetailPageData {
  const status = getBookingDetailStatus({
    endsAt: input.booking.ends_at,
    paymentStatus: input.sessionPayment?.financial_status ?? null,
    startsAt: input.booking.starts_at,
    status: input.booking.status,
  });
  const provider = getMeetingProvider(input.booking.meeting_provider);
  const canJoin =
    status === "live" &&
    input.sessionPayment?.financial_status === SessionFinancialStatus.Paid &&
    provider === "zoom";
  const ratingAverage =
    input.reviews.length > 0
      ? roundRating(
          input.reviews.reduce((sum, review) => sum + review.rating, 0) /
            input.reviews.length,
        )
      : null;
  const completedBookingsWithSummaries = input.completedBookings.filter(
    (booking) =>
      input.summaries.some((summary) => summary.booking_id === booking.id),
  );
  const journeyBookings =
    completedBookingsWithSummaries.length > 0
      ? completedBookingsWithSummaries
      : input.completedBookings;
  const firstJourneyBooking = journeyBookings
    .slice()
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() -
        new Date(right.starts_at).getTime(),
    )[0];
  const cancellationPolicy = {
    freeUntilHours: input.policy?.free_until_hours ?? 24,
    lateCancelFeePercent: input.policy?.late_cancel_fee_percent ?? 50,
    noShowFeePercent: input.policy?.no_show_fee_percent ?? 100,
  };

  return {
    actionPolicy: getPatientEncounterActionPolicy({
      bookingStatus: input.booking.status,
      cancellationDecision: input.cancellationDecision
        ? {
            decision: input.cancellationDecision.decision,
            refundAmountCents: input.cancellationDecision.refund_amount_cents,
            requiresManualReview:
              input.cancellationDecision.requires_manual_review,
            reviewDueAt: input.cancellationDecision.review_due_at,
          }
        : null,
      cancellationPolicy,
      endsAt: input.booking.ends_at,
      financialStatus: input.sessionPayment?.financial_status ?? null,
      startsAt: input.booking.starts_at,
    }),
    booking: {
      canJoin,
      dateLabel: formatSessionDate(
        input.booking.starts_at,
        input.booking.timezone,
      ),
      durationLabel: formatSessionDuration(
        input.booking.starts_at,
        input.booking.ends_at,
      ),
      endsAt: input.booking.ends_at,
      id: input.booking.id,
      minutesUntilStart: getMinutesUntilStart(input.booking.starts_at),
      operationalVersion: input.booking.version,
      paymentStatus: input.sessionPayment?.financial_status ?? null,
      startsAt: input.booking.starts_at,
      status,
      statusLabel: getBookingDetailStatusLabel(status),
      timeRangeLabel: formatSessionTimeRange(
        input.booking.starts_at,
        input.booking.ends_at,
        input.booking.timezone,
      ),
      timezone: input.booking.timezone,
    },
    cancellationPolicy,
    encounterState: getPatientEncounterPresentationState({
      bookingStatus: input.booking.status,
      endsAt: input.booking.ends_at,
      financialStatus: input.sessionPayment?.financial_status ?? null,
      provider,
      startsAt: input.booking.starts_at,
    }),
    intake: {
      focusArea: input.intake?.focus_area ?? "Seu momento atual",
      sharedNote:
        input.intake?.shared_note ??
        "Você poderá complementar suas informações antes do encontro, se desejar.",
      therapyGoal:
        input.intake?.therapy_goal ??
        input.service.description ??
        "Acompanhar sua jornada com presença e cuidado.",
      visibility: isIntakeVisibility(input.intake?.visibility)
        ? input.intake.visibility
        : "patient_therapist",
    },
    journey: {
      completedEncountersCount: journeyBookings.length,
      lastExploredTopic: input.intake?.focus_area ?? input.therapy.name,
      startedAtLabel: formatJourneyStartedAt(
        firstJourneyBooking?.starts_at ?? null,
        firstJourneyBooking?.timezone ?? input.booking.timezone,
      ),
      therapistName: input.therapist.public_name,
    },
    onlineSession: {
      joinRecommendation:
        "A sala de espera fica disponível 15 minutos antes do horário agendado.",
      meetingUrl: null,
      provider,
      securityNote:
        input.sessionPayment?.financial_status === SessionFinancialStatus.Paid
          ? "A sala é liberada por acesso autenticado. Não compartilhe seus dados de entrada."
          : "O link será liberado quando o pagamento estiver confirmado.",
    },
    patient: {
      avatarUrl: input.patientProfile.avatar_url ?? input.patient.avatar_url,
      id: input.patient.id,
      name:
        input.patientProfile.display_name ??
        input.patient.display_name ??
        "Paciente",
    },
    receipt: {
      amountCents: input.receipt?.amount_cents ?? null,
      currency: input.receipt?.currency ?? input.service.currency ?? "BRL",
      paidAt: input.receipt?.paid_at ?? null,
      receiptUrl: input.receipt?.receipt_url ?? null,
    },
    reschedule: mapReschedule(input.reschedule, input.patient.id),
    service: {
      id: input.service.id,
      objective:
        input.intake?.therapy_goal ??
        input.service.description ??
        "Acompanhar sua jornada com presença e cuidado.",
      therapyName: input.therapy.name,
      therapySlug: input.therapy.slug,
      title: input.service.title,
    },
    therapist: {
      avatarUrl: getTherapistAvatarUrl(input.therapist.photo_url, {
        name: input.therapist.public_name,
        slug: input.therapist.slug,
      }),
      id: input.therapist.id,
      isOnline: input.therapist.is_accepting_bookings,
      name: input.therapist.public_name,
      profileHref: `/terapeutas/${input.therapist.slug}`,
      ratingAverage,
      reviewsCount: input.reviews.length,
      roleLabel: input.therapist.headline ?? "Terapeuta",
    },
  };
}

function mapReschedule(
  row: BookingDetailRescheduleRow | null,
  currentProfileId: string,
): BookingDetailPageData["reschedule"] {
  if (!row || !isRescheduleStatus(row.status)) return null;

  return {
    expiresAt: row.expires_at,
    id: row.id,
    proposedEndsAt: row.proposed_ends_at,
    proposedStartsAt: row.proposed_starts_at,
    proposedTimezone: row.proposed_timezone,
    reason: row.reason,
    requestedByCurrentUser: row.requested_by_profile_id === currentProfileId,
    status: row.status,
  };
}

function isRescheduleStatus(
  value: string,
): value is NonNullable<BookingDetailPageData["reschedule"]>["status"] {
  return (
    value === "accepted" ||
    value === "applied" ||
    value === "cancelled" ||
    value === "expired" ||
    value === "pending" ||
    value === "rejected"
  );
}

function getMeetingProvider(
  provider: string | null,
): BookingDetailPageData["onlineSession"]["provider"] {
  if (provider === "zoom_video_sdk") return "zoom";
  if (provider === "zoom" || provider === "google_meet") return provider;

  return "external";
}

function isIntakeVisibility(
  value: string | null | undefined,
): value is BookingDetailPageData["intake"]["visibility"] {
  return (
    value === "patient_therapist" ||
    value === "private_patient" ||
    value === "support"
  );
}

function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}
