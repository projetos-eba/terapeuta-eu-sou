import "server-only";

import {
  getSupabaseServerRestConfig,
  supabaseServerRestRpc,
} from "@/lib/supabase/server-rest";

export async function queryTherapistSchedule(accessToken: string) {
  const config = getSupabaseServerRestConfig(accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  return supabaseServerRestRpc<unknown>(
    config,
    "get_therapist_schedule_v1",
    {},
  );
}
