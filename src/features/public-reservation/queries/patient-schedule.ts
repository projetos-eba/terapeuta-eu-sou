import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type { PatientScheduleInterval } from "../types";

type BlockingIntervalRow = {
  ends_at?: unknown;
  starts_at?: unknown;
};

export type PatientScheduleResult =
  | { intervals: PatientScheduleInterval[]; status: "success" }
  | { intervals: null; status: "error" };

export async function getPatientScheduleIntervals(input: {
  accessToken: string;
  end: Date;
  start: Date;
}): Promise<PatientScheduleResult> {
  const config = getSupabasePublicConfig();
  if (!config || !input.accessToken) {
    return { intervals: null, status: "error" };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/get_my_patient_schedule_blocking_intervals_v1`,
      {
        body: JSON.stringify({
          p_range_end: input.end.toISOString(),
          p_range_start: input.start.toISOString(),
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    if (!response.ok) {
      return { intervals: null, status: "error" };
    }

    const rows = (await response.json()) as unknown;
    if (!Array.isArray(rows)) return { intervals: null, status: "error" };
    const intervals = (rows as BlockingIntervalRow[]).map(mapScheduleRow);
    if (intervals.some((interval) => interval === null)) {
      return { intervals: null, status: "error" };
    }

    return {
      intervals: intervals as PatientScheduleInterval[],
      status: "success",
    };
  } catch {
    return { intervals: null, status: "error" };
  }
}

function mapScheduleRow(
  row: BlockingIntervalRow,
): PatientScheduleInterval | null {
  if (typeof row.starts_at !== "string" || typeof row.ends_at !== "string") {
    return null;
  }
  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    return null;
  }
  return { endsAt: endsAt.toISOString(), startsAt: startsAt.toISOString() };
}
