import "server-only";

import { cache } from "react";

import {
  getSupabaseServerRestConfig,
  supabaseServerRestRequest,
} from "@/lib/supabase/server-rest";

import {
  mapBookingDetail,
  type BookingDetailBookingRow,
  type BookingDetailCancellationPolicyRow,
  type BookingDetailIntakeRow,
  type BookingDetailPatientProfileRow,
  type BookingDetailProfileRow,
  type BookingDetailReceiptRow,
  type BookingDetailRescheduleRow,
  type BookingDetailReviewRow,
  type BookingDetailCancellationDecisionRow,
  type BookingDetailServiceRow,
  type BookingDetailSessionPaymentRow,
  type BookingDetailSessionSummaryRow,
  type BookingDetailTherapistRow,
  type BookingDetailTherapyRow,
  type BookingDetailVideoParticipationRow,
} from "./booking-detail.mappers";
import type {
  BookingDetailPageData,
  BookingDetailQueryInput,
} from "./booking-detail.types";

export class BookingDetailDataError extends Error {
  constructor(readonly code: "not_found" | "unavailable" = "unavailable") {
    super("Não foi possível carregar os detalhes do encontro.");
  }
}

export const getPatientSessionDetailPage = cache(
  async function getPatientSessionDetailPage({
    accessToken,
    bookingId,
    profileId,
  }: BookingDetailQueryInput): Promise<BookingDetailPageData> {
    const config = getSupabaseServerRestConfig(accessToken);

    if (!config) {
      if (process.env.NODE_ENV === "development") {
        return createDemoBookingDetail(profileId, bookingId);
      }

      throw new BookingDetailDataError("unavailable");
    }

    try {
      const [profiles, patientProfiles] = await Promise.all([
        supabaseServerRestRequest<BookingDetailProfileRow[]>(
          config,
          `/rest/v1/profiles?select=id,display_name,avatar_url&id=eq.${encodeURIComponent(profileId)}&limit=1`,
        ),
        supabaseServerRestRequest<BookingDetailPatientProfileRow[]>(
          config,
          `/rest/v1/patient_profiles?select=id,display_name,avatar_url&user_id=eq.${encodeURIComponent(profileId)}&limit=1`,
        ),
      ]);
      const profile = profiles[0];
      const patientProfile = patientProfiles[0];

      if (!profile || !patientProfile) {
        throw new BookingDetailDataError("not_found");
      }

      const bookings = await supabaseServerRestRequest<
        BookingDetailBookingRow[]
      >(
        config,
        `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,service_title_snapshot,service_duration_minutes_snapshot,service_price_cents_snapshot,currency_snapshot,starts_at,ends_at,timezone,status,meeting_provider,completed_at,version&id=eq.${encodeURIComponent(bookingId)}&patient_profile_id=eq.${patientProfile.id}&limit=1`,
      );
      const booking = bookings[0];

      if (!booking) {
        throw new BookingDetailDataError("not_found");
      }

      const [
        therapists,
        services,
        intakeRows,
        receiptRows,
        paymentRows,
        rescheduleRows,
        cancellationDecisionRows,
        patientParticipationRows,
      ] = await Promise.all([
        supabaseServerRestRequest<BookingDetailTherapistRow[]>(
          config,
          `/rest/v1/therapist_profiles?select=id,slug,public_name,headline,photo_url,is_accepting_bookings&id=eq.${booking.therapist_profile_id}&limit=1`,
        ),
        supabaseServerRestRequest<BookingDetailServiceRow[]>(
          config,
          `/rest/v1/therapist_services?select=id,title,description,duration_minutes,price_cents,currency,therapy_id&id=eq.${booking.service_id}&limit=1`,
        ),
        supabaseServerRestRequest<BookingDetailIntakeRow[]>(
          config,
          `/rest/v1/booking_intake_responses?select=focus_area,shared_note,therapy_goal,visibility&booking_id=eq.${booking.id}&limit=1`,
        ),
        supabaseServerRestRequest<BookingDetailReceiptRow[]>(
          config,
          `/rest/v1/booking_payment_receipts?select=amount_cents,currency,receipt_url,paid_at&booking_id=eq.${booking.id}&limit=1`,
        ),
        supabaseServerRestRequest<BookingDetailSessionPaymentRow[]>(
          config,
          `/rest/v1/session_payments?select=id,financial_status,refund_pending&booking_id=eq.${booking.id}&limit=1`,
        ),
        supabaseServerRestRequest<BookingDetailRescheduleRow[]>(
          config,
          `/rest/v1/booking_reschedule_requests?select=id,requested_by_profile_id,proposed_starts_at,proposed_ends_at,proposed_timezone,reason,status,expires_at&booking_id=eq.${booking.id}&order=created_at.desc&limit=1`,
        ),
        supabaseServerRestRequest<BookingDetailCancellationDecisionRow[]>(
          config,
          `/rest/v1/session_cancellation_decisions?select=decision,refund_amount_cents,requires_manual_review,review_due_at&booking_id=eq.${booking.id}&order=created_at.desc&limit=1`,
        ),
        supabaseServerRestRequest<BookingDetailVideoParticipationRow[]>(
          config,
          `/rest/v1/video_session_participations?select=id&booking_id=eq.${booking.id}&participant_role=eq.patient&event_type=eq.session.user_joined&limit=1`,
        ),
      ]);
      const therapist = therapists[0];
      const service = services[0] ?? createSnapshotService(booking);

      if (!therapist || !service) {
        throw new BookingDetailDataError("not_found");
      }

      const therapyPromise = service.therapy_id
        ? supabaseServerRestRequest<BookingDetailTherapyRow[]>(
            config,
            `/rest/v1/therapies?select=id,name,slug&id=eq.${service.therapy_id}&limit=1`,
          )
        : Promise.resolve<BookingDetailTherapyRow[]>([]);

      const [therapies, reviews, policyRows, completedBookings] =
        await Promise.all([
          therapyPromise,
          supabaseServerRestRequest<BookingDetailReviewRow[]>(
            config,
            `/rest/v1/reviews?select=rating&therapist_profile_id=eq.${therapist.id}&status=eq.published`,
          ),
          supabaseServerRestRequest<BookingDetailCancellationPolicyRow[]>(
            config,
            `/rest/v1/therapist_service_cancellation_policies?select=free_until_hours,late_cancel_fee_percent,no_show_fee_percent&service_id=eq.${service.id}&limit=1`,
          ),
          supabaseServerRestRequest<BookingDetailBookingRow[]>(
            config,
            `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,service_title_snapshot,service_duration_minutes_snapshot,service_price_cents_snapshot,currency_snapshot,starts_at,ends_at,timezone,status,meeting_provider,completed_at,version&patient_profile_id=eq.${patientProfile.id}&therapist_profile_id=eq.${therapist.id}&status=eq.completed&order=starts_at.asc`,
          ),
        ]);
      const therapy = therapies[0] ?? createSnapshotTherapy(service);

      const completedBookingIds = completedBookings.map((item) => item.id);
      const summaries =
        completedBookingIds.length > 0
          ? await supabaseServerRestRequest<BookingDetailSessionSummaryRow[]>(
              config,
              `/rest/v1/booking_session_summaries?select=booking_id,title,summary,created_at&booking_id=in.(${completedBookingIds.join(",")})`,
            )
          : [];

      return mapBookingDetail({
        booking,
        completedBookings,
        intake: intakeRows[0] ?? null,
        patient: profile,
        patientHasJoined: patientParticipationRows.length > 0,
        patientProfile,
        perspective: "patient",
        policy: policyRows[0] ?? null,
        receipt: receiptRows[0] ?? null,
        reschedule: rescheduleRows[0] ?? null,
        reviews,
        cancellationDecision: cancellationDecisionRows[0] ?? null,
        service,
        sessionPayment: paymentRows[0] ?? null,
        summaries,
        therapist,
        therapy,
      });
    } catch (error) {
      if (error instanceof BookingDetailDataError) throw error;

      throw new BookingDetailDataError("unavailable");
    }
  },
);

function createDemoBookingDetail(
  profileId: string,
  bookingId: string,
): BookingDetailPageData {
  const startsAt = new Date(Date.now() + 10 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  return mapBookingDetail({
    booking: {
      completed_at: null,
      currency_snapshot: "BRL",
      ends_at: endsAt.toISOString(),
      id: bookingId,
      meeting_provider: "zoom",
      patient_profile_id: "91000000-0000-4000-8000-000000000001",
      service_duration_minutes_snapshot: 60,
      service_id: "93000000-0000-4000-8000-000000000020",
      service_price_cents_snapshot: 17000,
      service_title_snapshot: "Reiki",
      starts_at: startsAt.toISOString(),
      status: "confirmed",
      therapist_profile_id: "92000000-0000-4000-8000-000000000011",
      timezone: "America/Sao_Paulo",
      version: 1,
    },
    completedBookings: Array.from({ length: 3 }, (_, index) => ({
      completed_at: new Date(2024, 4, 10 + index).toISOString(),
      currency_snapshot: "BRL",
      ends_at: new Date(2024, 4, 10 + index, 15).toISOString(),
      id: `96000000-0000-4000-8000-00000000000${2 + index}`,
      meeting_provider: "zoom",
      patient_profile_id: "91000000-0000-4000-8000-000000000001",
      service_duration_minutes_snapshot: 60,
      service_id: "93000000-0000-4000-8000-000000000020",
      service_price_cents_snapshot: 17000,
      service_title_snapshot: "Reiki",
      starts_at: new Date(2024, 4, 10 + index, 14).toISOString(),
      status: "completed",
      therapist_profile_id: "92000000-0000-4000-8000-000000000011",
      timezone: "America/Sao_Paulo",
      version: 1,
    })),
    intake: {
      focus_area: "Autoconhecimento",
      shared_note:
        "Gostaria de entender melhor um momento de mudança que estou vivendo e buscar mais clareza para tomar decisões importantes.",
      therapy_goal:
        "Promover equilíbrio, clareza e conexão interna através do Reiki.",
      visibility: "patient_therapist",
    },
    patient: {
      avatar_url: null,
      display_name: "Carlos",
      id: profileId,
    },
    patientHasJoined: false,
    patientProfile: {
      avatar_url: null,
      display_name: "Carlos",
      id: "91000000-0000-4000-8000-000000000001",
    },
    perspective: "patient",
    policy: {
      free_until_hours: 24,
      late_cancel_fee_percent: 50,
      no_show_fee_percent: 100,
    },
    receipt: {
      amount_cents: 17000,
      currency: "BRL",
      paid_at: new Date(Date.now() - 86_400_000).toISOString(),
      receipt_url: `/app/pagamentos/comprovantes/${bookingId}`,
    },
    reschedule: null,
    reviews: [{ rating: 5 }, { rating: 5 }, { rating: 5 }],
    cancellationDecision: null,
    service: {
      currency: "BRL",
      description: "Sessão online de Reiki.",
      duration_minutes: 60,
      id: "93000000-0000-4000-8000-000000000020",
      price_cents: 17000,
      therapy_id: "22222222-2222-4222-8222-222222222225",
      title: "Reiki",
    },
    sessionPayment: {
      id: "97000000-0000-4000-8000-000000000001",
      financial_status: "paid",
      refund_pending: false,
    },
    summaries: Array.from({ length: 3 }, (_, index) => ({
      booking_id: `96000000-0000-4000-8000-00000000000${2 + index}`,
      created_at: new Date(2024, 4, 10 + index).toISOString(),
      summary: "Resumo da jornada de autoconhecimento.",
      title: "Autoconhecimento",
    })),
    therapist: {
      headline: "Terapeuta Holística",
      id: "92000000-0000-4000-8000-000000000011",
      is_accepting_bookings: true,
      photo_url: "/therapists/juliana-costa.png",
      public_name: "Juliane Moore",
      slug: "juliane-moore",
    },
    therapy: {
      id: "22222222-2222-4222-8222-222222222225",
      name: "Reiki",
      slug: "reiki",
    },
  });
}

function createSnapshotService(
  booking: BookingDetailBookingRow,
): BookingDetailServiceRow | null {
  if (!booking.service_title_snapshot) return null;

  return {
    currency: booking.currency_snapshot ?? "BRL",
    description: null,
    duration_minutes: booking.service_duration_minutes_snapshot ?? 60,
    id: booking.service_id,
    price_cents: booking.service_price_cents_snapshot ?? 0,
    therapy_id: null,
    title: booking.service_title_snapshot,
  };
}

function createSnapshotTherapy(
  service: BookingDetailServiceRow,
): BookingDetailTherapyRow {
  return {
    id: service.therapy_id ?? service.id,
    name: service.title,
    slug: "terapia-contratada",
  };
}
