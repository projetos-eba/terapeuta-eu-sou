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
  type BookingDetailReviewRow,
  type BookingDetailServiceRow,
  type BookingDetailSessionSummaryRow,
  type BookingDetailTherapistRow,
  type BookingDetailTherapyRow,
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
    bookingId,
    profileId,
  }: BookingDetailQueryInput): Promise<BookingDetailPageData> {
    const config = getSupabaseServerRestConfig();

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

      const bookings = await supabaseServerRestRequest<BookingDetailBookingRow[]>(
        config,
        `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,payment_status,meeting_provider,meeting_url,completed_at&id=eq.${encodeURIComponent(bookingId)}&patient_profile_id=eq.${patientProfile.id}&limit=1`,
      );
      const booking = bookings[0];

      if (!booking) {
        throw new BookingDetailDataError("not_found");
      }

      const [therapists, services, intakeRows, receiptRows] =
        await Promise.all([
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
        ]);
      const therapist = therapists[0];
      const service = services[0];

      if (!therapist || !service) {
        throw new BookingDetailDataError("not_found");
      }

      const [therapies, reviews, policyRows, completedBookings] =
        await Promise.all([
          supabaseServerRestRequest<BookingDetailTherapyRow[]>(
            config,
            `/rest/v1/therapies?select=id,name,slug&id=eq.${service.therapy_id}&limit=1`,
          ),
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
            `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,service_id,starts_at,ends_at,timezone,status,payment_status,meeting_provider,meeting_url,completed_at&patient_profile_id=eq.${patientProfile.id}&therapist_profile_id=eq.${therapist.id}&status=eq.completed&order=starts_at.asc`,
          ),
        ]);
      const therapy = therapies[0];

      if (!therapy) {
        throw new BookingDetailDataError("not_found");
      }

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
        patientProfile,
        perspective: "patient",
        policy: policyRows[0] ?? null,
        receipt: receiptRows[0] ?? null,
        reviews,
        service,
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
      ends_at: endsAt.toISOString(),
      id: bookingId,
      meeting_provider: "zoom",
      meeting_url: "https://us02web.zoom.us/j/1234567890?pwd=terapiaeusou",
      patient_profile_id: "91000000-0000-4000-8000-000000000001",
      payment_status: "paid",
      service_id: "93000000-0000-4000-8000-000000000020",
      starts_at: startsAt.toISOString(),
      status: "confirmed",
      therapist_profile_id: "92000000-0000-4000-8000-000000000011",
      timezone: "America/Sao_Paulo",
    },
    completedBookings: Array.from({ length: 3 }, (_, index) => ({
      completed_at: new Date(2024, 4, 10 + index).toISOString(),
      ends_at: new Date(2024, 4, 10 + index, 15).toISOString(),
      id: `96000000-0000-4000-8000-00000000000${2 + index}`,
      meeting_provider: "zoom",
      meeting_url: null,
      patient_profile_id: "91000000-0000-4000-8000-000000000001",
      payment_status: "paid",
      service_id: "93000000-0000-4000-8000-000000000020",
      starts_at: new Date(2024, 4, 10 + index, 14).toISOString(),
      status: "completed",
      therapist_profile_id: "92000000-0000-4000-8000-000000000011",
      timezone: "America/Sao_Paulo",
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
    reviews: [{ rating: 5 }, { rating: 5 }, { rating: 5 }],
    service: {
      currency: "BRL",
      description: "Sessão online de Reiki.",
      duration_minutes: 60,
      id: "93000000-0000-4000-8000-000000000020",
      price_cents: 17000,
      therapy_id: "22222222-2222-4222-8222-222222222225",
      title: "Reiki",
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
