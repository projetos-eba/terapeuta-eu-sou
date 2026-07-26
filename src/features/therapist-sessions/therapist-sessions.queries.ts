import "server-only";

import {
  getSupabaseServerRestConfig,
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
      p_financial_status: filters.financialStatus ?? null,
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
