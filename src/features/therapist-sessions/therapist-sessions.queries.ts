import "server-only";

import {
  getSupabaseServerRestConfig,
  supabaseServerRestRequest,
  supabaseServerRestRpc,
} from "@/lib/supabase/server-rest";

import type { TherapistSessionFilters } from "@/features/bookings";

export async function queryTherapistSessions(
  accessToken: string,
  filters: TherapistSessionFilters,
) {
  const config = getSupabaseServerRestConfig(accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  return supabaseServerRestRpc<unknown>(
    config,
    "get_therapist_sessions_v1",
    {
      p_booking_status: filters.bookingStatus ?? null,
      p_cursor_booking_id: filters.cursor?.bookingId ?? null,
      p_cursor_starts_at: filters.cursor?.startsAt ?? null,
      p_financial_status: null,
      p_limit: filters.limit,
      p_modality: filters.modality ?? null,
      p_patient_profile_id: filters.patientProfileId ?? null,
      p_period_end: filters.periodEnd ?? null,
      p_period_start: filters.periodStart ?? null,
      p_service_id: filters.serviceId ?? null,
    },
  );
}

export async function queryTherapistSessionDetail(
  accessToken: string,
  bookingId: string,
) {
  const config = getSupabaseServerRestConfig(accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  return supabaseServerRestRpc<unknown>(
    config,
    "get_therapist_session_detail_v1",
    { p_booking_id: bookingId },
  );
}

export async function queryTherapistSessionFeedback(
  accessToken: string,
  bookingId: string,
) {
  const config = getSupabaseServerRestConfig(accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  return supabaseServerRestRpc<unknown>(config, "get_session_feedback_v2", {
    p_booking_id: bookingId,
  });
}

export type TherapistPendingRescheduleRow = {
  expires_at: string | null;
  id: string;
  proposed_ends_at: string;
  proposed_starts_at: string;
  proposed_timezone: string;
  reason: string | null;
  requested_by_profile_id: string;
  status: "pending";
};

export async function queryTherapistPendingReschedule(
  accessToken: string,
  bookingId: string,
) {
  const config = getSupabaseServerRestConfig(accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  const rows = await supabaseServerRestRequest<TherapistPendingRescheduleRow[]>(
    config,
    `/rest/v1/booking_reschedule_requests?select=id,requested_by_profile_id,proposed_starts_at,proposed_ends_at,proposed_timezone,reason,status,expires_at&booking_id=eq.${encodeURIComponent(bookingId)}&status=eq.pending&order=created_at.desc&limit=1`,
  );

  return rows[0] ?? null;
}
