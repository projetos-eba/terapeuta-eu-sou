import "server-only";

import {
  getSupabaseServerRestConfig,
  supabaseServerRestRequest,
} from "@/lib/supabase/server-rest";

export type SessionDelayNoticeState = {
  participantJoined: boolean;
  sentAt: string | null;
};

export async function getSessionDelayNoticeState(input: {
  accessToken: string;
  actorRole: "patient" | "therapist";
  bookingId: string;
  bookingVersion: number;
  userId: string;
}): Promise<SessionDelayNoticeState> {
  const config = getSupabaseServerRestConfig(input.accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  const requestId = `session-delay:${input.actorRole}:v${input.bookingVersion}`;
  const [events, joins] = await Promise.all([
    supabaseServerRestRequest<Array<{ created_at: string }>>(
      config,
      `/rest/v1/booking_events?select=created_at&booking_id=eq.${encodeURIComponent(input.bookingId)}&actor_profile_id=eq.${encodeURIComponent(input.userId)}&event_type=eq.session_delay_notice_sent&request_id=eq.${encodeURIComponent(requestId)}&limit=1`,
    ),
    supabaseServerRestRequest<Array<{ id: string }>>(
      config,
      `/rest/v1/video_session_participations?select=id&booking_id=eq.${encodeURIComponent(input.bookingId)}&participant_role=eq.${input.actorRole}&event_type=eq.session.user_joined&limit=1`,
    ),
  ]);

  return {
    participantJoined: joins.length > 0,
    sentAt: events[0]?.created_at ?? null,
  };
}
