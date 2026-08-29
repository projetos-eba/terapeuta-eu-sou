import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type { PatientScheduleInterval } from "../types";

type ScheduleRow = {
  ends_at?: unknown;
  service_id?: unknown;
  starts_at?: unknown;
};

type CurrentReservation = {
  serviceId: string;
  startsAt: string;
};

export type PatientScheduleResult =
  | { intervals: PatientScheduleInterval[]; status: "success" }
  | { intervals: null; status: "error" };

export async function getPatientScheduleIntervals(input: {
  accessToken: string;
  currentReservation?: CurrentReservation;
  end: Date;
  now?: Date;
  start: Date;
}): Promise<PatientScheduleResult> {
  const config = getSupabasePublicConfig();
  if (!config || !input.accessToken) {
    return { intervals: null, status: "error" };
  }

  const common = {
    end: input.end.toISOString(),
    start: input.start.toISOString(),
  };
  const now = (input.now ?? new Date()).toISOString();

  try {
    const [bookings, holds] = await Promise.all([
      requestRows(config, input.accessToken, "bookings", {
        ...common,
        status: "in.(draft,pending_payment,confirmed)",
      }),
      requestRows(config, input.accessToken, "booking_holds", {
        ...common,
        expiresAt: now,
        status: "eq.active",
      }),
    ]);

    if (!bookings || !holds) {
      return { intervals: null, status: "error" };
    }

    const intervals = [
      ...bookings.filter(
        (booking) =>
          !isCurrentReservationBooking(booking, input.currentReservation),
      ),
      ...holds,
    ].map(mapScheduleRow);
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

async function requestRows(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  table: "booking_holds" | "bookings",
  filters: {
    end: string;
    expiresAt?: string;
    start: string;
    status: string;
  },
) {
  const params = new URLSearchParams({
    ends_at: `gt.${filters.start}`,
    order: "starts_at.asc",
    select: "starts_at,ends_at,service_id",
    starts_at: `lt.${filters.end}`,
    status: filters.status,
  });
  if (filters.expiresAt) params.set("expires_at", `gt.${filters.expiresAt}`);

  const response = await fetch(
    `${config.url}/rest/v1/${table}?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) return null;
  const rows = (await response.json()) as unknown;
  return Array.isArray(rows) ? (rows as ScheduleRow[]) : null;
}

function isCurrentReservationBooking(
  row: ScheduleRow,
  currentReservation: CurrentReservation | undefined,
) {
  if (
    !currentReservation ||
    row.service_id !== currentReservation.serviceId ||
    typeof row.starts_at !== "string"
  ) {
    return false;
  }

  const startsAt = new Date(row.starts_at);
  return (
    Number.isFinite(startsAt.getTime()) &&
    startsAt.toISOString() === currentReservation.startsAt
  );
}

function mapScheduleRow(row: ScheduleRow): PatientScheduleInterval | null {
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
