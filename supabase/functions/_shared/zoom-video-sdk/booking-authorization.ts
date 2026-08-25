import { SupabaseRestClient } from "../auth/supabase-rest.ts";
import { DomainError } from "../payments/http.ts";

export type AuthorizedVideoBooking = {
  bookingStatus: string;
  endsAt: string;
  financialStatus: string | null;
  patientProfileId: string;
  patientHasJoined: boolean;
  startsAt: string;
  therapistProfileId: string;
  therapistStatus: string;
  timezone: string;
  videoSession: {
    hardEndsAt: string | null;
    id: string;
    providerSessionId: string | null;
    sessionKey: string | null;
    sessionName: string;
    status: string;
    therapistFirstJoinedAt: string | null;
    therapistLastLeftAt: string | null;
    therapistPresent: boolean;
  } | null;
};

export async function getAuthorizedVideoBooking(input: {
  bookingId: string;
  client: SupabaseRestClient;
  environment: string;
  profileId: string;
  role: "patient" | "therapist";
}) {
  const [booking] = await input.client.get<
    Array<{
      ends_at: string;
      id: string;
      patient_profile_id: string;
      starts_at: string;
      status: string;
      therapist_profile_id: string;
      therapist_profiles: { status: string } | null;
      timezone: string;
    }>
  >(
    `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,starts_at,ends_at,timezone,status,therapist_profiles(status)&id=eq.${encodeURIComponent(input.bookingId)}&limit=1`,
  );

  if (!booking) {
    throw new DomainError("booking_not_found", 404, "Sessao nao encontrada.");
  }

  if (
    (input.role === "patient" &&
      booking.patient_profile_id !== input.profileId) ||
    (input.role === "therapist" &&
      booking.therapist_profile_id !== input.profileId)
  ) {
    throw new DomainError(
      "booking_forbidden",
      403,
      "Voce nao pode acessar esta sessao.",
    );
  }

  const [payment] = await input.client.get<Array<{ financial_status: string }>>(
    `/rest/v1/session_payments?select=financial_status&booking_id=eq.${encodeURIComponent(input.bookingId)}&limit=1`,
  );
  let [videoSession] = await input.client.get<
    Array<{
      hard_ends_at: string | null;
      id: string;
      provider_session_id: string | null;
      session_key: string | null;
      session_name: string;
      status: string;
      therapist_first_joined_at: string | null;
      therapist_last_left_at: string | null;
      therapist_present: boolean;
    }>
  >(
    `/rest/v1/video_sessions?select=id,session_name,session_key,status,provider_session_id,hard_ends_at,therapist_first_joined_at,therapist_last_left_at,therapist_present&booking_id=eq.${encodeURIComponent(input.bookingId)}&limit=1`,
  );

  if (!videoSession && payment?.financial_status === "paid") {
    await input.client.rpc("ensure_video_session_for_paid_booking_v1", {
      p_booking_id: input.bookingId,
      p_environment: input.environment,
      p_source: "video-session-access",
    });
    [videoSession] = await input.client.get<
      Array<{
        hard_ends_at: string | null;
        id: string;
        provider_session_id: string | null;
        session_key: string | null;
        session_name: string;
        status: string;
        therapist_first_joined_at: string | null;
        therapist_last_left_at: string | null;
        therapist_present: boolean;
      }>
    >(
      `/rest/v1/video_sessions?select=id,session_name,session_key,status,provider_session_id,hard_ends_at,therapist_first_joined_at,therapist_last_left_at,therapist_present&booking_id=eq.${encodeURIComponent(input.bookingId)}&limit=1`,
    );
  }

  const patientParticipation = videoSession
    ? await input.client.get<Array<{ id: string }>>(
        `/rest/v1/video_session_participations?select=id&video_session_id=eq.${encodeURIComponent(videoSession.id)}&participant_role=eq.patient&event_type=eq.session.user_joined&limit=1`,
      )
    : [];

  return {
    bookingStatus: booking.status,
    endsAt: booking.ends_at,
    financialStatus: payment?.financial_status ?? null,
    patientProfileId: booking.patient_profile_id,
    patientHasJoined: patientParticipation.length > 0,
    startsAt: booking.starts_at,
    therapistProfileId: booking.therapist_profile_id,
    therapistStatus: booking.therapist_profiles?.status ?? "unknown",
    timezone: booking.timezone,
    videoSession: videoSession
      ? {
          hardEndsAt: videoSession.hard_ends_at,
          id: videoSession.id,
          providerSessionId: videoSession.provider_session_id,
          sessionKey: videoSession.session_key,
          sessionName: videoSession.session_name,
          status: videoSession.status,
          therapistFirstJoinedAt: videoSession.therapist_first_joined_at,
          therapistLastLeftAt: videoSession.therapist_last_left_at,
          therapistPresent: videoSession.therapist_present,
        }
      : null,
  } satisfies AuthorizedVideoBooking;
}
