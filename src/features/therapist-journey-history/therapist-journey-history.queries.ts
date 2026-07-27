import "server-only";

import {
  getRowsByIds,
  getSupabaseServerRestConfig,
  supabaseServerRestRequest,
} from "@/lib/supabase/server-rest";

import type {
  JourneyBookingRow,
  JourneyHistoryRows,
  JourneyPatientRow,
  JourneyRelationshipRow,
  JourneyServiceRow,
  JourneySummaryRow,
} from "./therapist-journey-history.mappers";

export async function queryTherapistJourneyHistory(input: {
  accessToken: string;
  therapistProfileId: string;
}): Promise<JourneyHistoryRows> {
  const config = getSupabaseServerRestConfig(input.accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  const therapistProfileId = encodeURIComponent(input.therapistProfileId);
  const [relationships, bookings] = await Promise.all([
    supabaseServerRestRequest<JourneyRelationshipRow[]>(
      config,
      `/rest/v1/therapist_patient_relationships?select=patient_profile_id,status,started_at&therapist_profile_id=eq.${therapistProfileId}&order=started_at.desc&limit=200`,
    ),
    supabaseServerRestRequest<JourneyBookingRow[]>(
      config,
      `/rest/v1/bookings?select=id,patient_profile_id,service_id,starts_at,ends_at,status,payment_status,completed_at,created_at&therapist_profile_id=eq.${therapistProfileId}&order=starts_at.desc&limit=500`,
    ),
  ]);
  const patientIds = [
    ...new Set([
      ...relationships.map((row) => row.patient_profile_id),
      ...bookings.map((row) => row.patient_profile_id),
    ]),
  ];
  const serviceIds = [...new Set(bookings.map((row) => row.service_id))];

  const [patients, services, summaries] = await Promise.all([
    getRowsByIds<JourneyPatientRow>(
      config,
      "patient_profiles",
      "id,user_id,display_name,avatar_url,timezone",
      patientIds,
    ),
    getRowsByIds<JourneyServiceRow>(
      config,
      "therapist_services",
      "id,title",
      serviceIds,
    ),
    patientIds.length > 0
      ? supabaseServerRestRequest<JourneySummaryRow[]>(
          config,
          `/rest/v1/booking_session_summaries?select=booking_id,patient_profile_id,title,summary,visibility,created_at&therapist_profile_id=eq.${therapistProfileId}&patient_profile_id=in.(${patientIds.join(",")})&order=created_at.desc&limit=300`,
        )
      : Promise.resolve([]),
  ]);

  return {
    bookings,
    patients,
    relationships,
    services,
    summaries,
  };
}
