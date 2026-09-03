import { SupabaseRestClient } from "../auth/supabase-rest.ts";
import { DomainError } from "../payments/http.ts";

export type AuthorizedVideoBooking = {
  bookingStatus: string;
  endsAt: string;
  financialStatus: string | null;
  patientProfileId: string;
  patientHasJoined: boolean;
  patientHasTimelyArrival: boolean;
  startsAt: string;
  therapistProfileId: string;
  therapistProfileEligible: boolean;
  therapistStatus: string;
  timezone: string;
  videoSession: {
    hardEndsAt: string | null;
    terminationRequestedAt: string | null;
    terminationConfirmedAt: string | null;
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
      version: number;
      patient_profile_id: string;
      starts_at: string;
      status: string;
      therapist_profile_id: string;
      therapist_profiles: { status: string } | null;
      timezone: string;
    }>
  >(
    `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,starts_at,ends_at,timezone,status,version,therapist_profiles(status)&id=eq.${encodeURIComponent(
      input.bookingId,
    )}&limit=1`,
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
    `/rest/v1/session_payments?select=financial_status&booking_id=eq.${encodeURIComponent(
      input.bookingId,
    )}&limit=1`,
  );
  let [videoSession] = await input.client.get<
    Array<{
      hard_ends_at: string | null;
      termination_requested_at: string | null;
      termination_confirmed_at: string | null;
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
    `/rest/v1/video_sessions?select=id,session_name,session_key,status,provider_session_id,hard_ends_at,termination_requested_at,termination_confirmed_at,therapist_first_joined_at,therapist_last_left_at,therapist_present&booking_id=eq.${encodeURIComponent(
      input.bookingId,
    )}&limit=1`,
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
        termination_requested_at: string | null;
        termination_confirmed_at: string | null;
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
      `/rest/v1/video_sessions?select=id,session_name,session_key,status,provider_session_id,hard_ends_at,termination_requested_at,termination_confirmed_at,therapist_first_joined_at,therapist_last_left_at,therapist_present&booking_id=eq.${encodeURIComponent(
        input.bookingId,
      )}&limit=1`,
    );
  }

  const patientParticipation = videoSession
    ? await input.client.get<Array<{ id: string }>>(
        `/rest/v1/video_session_participations?select=id&video_session_id=eq.${encodeURIComponent(
          videoSession.id,
        )}&participant_role=eq.patient&event_type=eq.session.user_joined&limit=1`,
      )
    : [];
  const therapistProfileEligible =
    input.role === "therapist"
      ? await input.client.rpc<boolean>(
          "is_therapist_video_session_eligible_v1",
          { p_therapist_profile_id: booking.therapist_profile_id },
        )
      : true;
  // Both actors are governed by the same patient-attendance evidence after
  // T+10. This remains read-only for therapists; only the patient access path
  // records a new arrival through the service-only RPC.
  const patientArrivalEvents = await input.client.get<
    Array<{ payload: unknown }>
  >(
    `/rest/v1/booking_events?select=payload&booking_id=eq.${encodeURIComponent(
      input.bookingId,
    )}&event_type=eq.zoom_waiting_room_entered&limit=20`,
  );
  const patientHasTimelyArrival = patientArrivalEvents.some((event) =>
    isCurrentBookingArrival(event.payload, booking.version, booking.starts_at),
  );

  return {
    bookingStatus: booking.status,
    endsAt: booking.ends_at,
    financialStatus: payment?.financial_status ?? null,
    patientProfileId: booking.patient_profile_id,
    patientHasJoined: patientParticipation.length > 0,
    patientHasTimelyArrival,
    startsAt: booking.starts_at,
    therapistProfileId: booking.therapist_profile_id,
    therapistProfileEligible: therapistProfileEligible === true,
    therapistStatus: booking.therapist_profiles?.status ?? "unknown",
    timezone: booking.timezone,
    videoSession: videoSession
      ? {
          hardEndsAt: videoSession.hard_ends_at,
          terminationRequestedAt: videoSession.termination_requested_at ?? null,
          terminationConfirmedAt: videoSession.termination_confirmed_at ?? null,
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

function isCurrentBookingArrival(
  value: unknown,
  bookingVersion: number,
  startsAt: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (Number(payload.bookingVersion) !== bookingVersion) return false;
  if (typeof payload.scheduledStartsAt !== "string") return false;

  return Date.parse(payload.scheduledStartsAt) === Date.parse(startsAt);
}
