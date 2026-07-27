import "server-only";

import {
  getSupabaseServerRestConfig,
  supabaseServerRestRpc,
} from "@/lib/supabase/server-rest";

export type TherapistBlocksFilters = {
  cursorId?: string;
  cursorStartsAt?: string;
  limit?: number;
  rangeEnd?: string;
  rangeStart?: string;
  reasonCode?: string;
  search?: string;
  status?: "active" | "all" | "cancelled";
};

export async function queryTherapistBlocks(
  accessToken: string,
  filters: TherapistBlocksFilters = {},
) {
  const config = getSupabaseServerRestConfig(accessToken);
  if (!config) throw new Error("SUPABASE_CONFIG_UNAVAILABLE");

  return supabaseServerRestRpc<unknown>(config, "get_therapist_blocks_v1", {
    p_cursor_id: filters.cursorId ?? null,
    p_cursor_starts_at: filters.cursorStartsAt ?? null,
    p_limit: filters.limit ?? 20,
    p_range_end: filters.rangeEnd ?? null,
    p_range_start: filters.rangeStart ?? null,
    p_reason_code: filters.reasonCode ?? null,
    p_search: filters.search ?? null,
    p_status: filters.status ?? "active",
  });
}
