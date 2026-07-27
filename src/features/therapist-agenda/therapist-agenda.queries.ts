import "server-only";

import {
  getSupabaseServerRestConfig,
  supabaseServerRestRpc,
} from "@/lib/supabase/server-rest";

export async function queryTherapistAgenda(input: {
  accessToken: string;
  rangeEnd?: string;
  rangeStart?: string;
}) {
  const config = getSupabaseServerRestConfig(input.accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  return supabaseServerRestRpc<unknown>(config, "get_therapist_agenda_v1", {
    p_range_end: input.rangeEnd ?? null,
    p_range_start: input.rangeStart ?? null,
  });
}

export async function queryTherapistCalendar(input: {
  accessToken: string;
  anchorDate?: string;
  view: "day" | "month" | "week";
}) {
  const config = getSupabaseServerRestConfig(input.accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  return supabaseServerRestRpc<unknown>(config, "get_therapist_calendar_v1", {
    p_anchor_date: input.anchorDate ?? null,
    p_view: input.view,
  });
}
