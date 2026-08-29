import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import type { PatientScheduleInterval } from "../types";

type BookingRow = {
  ends_at?: unknown;
  id?: unknown;
  starts_at?: unknown;
};

type PaidSessionPaymentRow = {
  booking_id?: unknown;
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

  const common = {
    end: input.end.toISOString(),
    start: input.start.toISOString(),
  };
  try {
    const bookings = await requestBookingRows(config, input.accessToken, {
      ...common,
      status: "in.(confirmed,completed)",
    });

    if (!bookings) {
      return { intervals: null, status: "error" };
    }

    const bookingIds = bookings.map((booking) => booking.id);
    if (bookingIds.some((bookingId) => typeof bookingId !== "string")) {
      return { intervals: null, status: "error" };
    }

    const paidBookingIds = await requestPaidBookingIds(
      config,
      input.accessToken,
      bookingIds as string[],
    );
    if (!paidBookingIds) {
      return { intervals: null, status: "error" };
    }

    const intervals = bookings
      .filter(
        (booking) =>
          typeof booking.id === "string" && paidBookingIds.has(booking.id),
      )
      .map(mapScheduleRow);
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

async function requestBookingRows(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  filters: {
    end: string;
    start: string;
    status: string;
  },
) {
  const params = new URLSearchParams({
    ends_at: `gt.${filters.start}`,
    order: "starts_at.asc",
    select: "id,starts_at,ends_at",
    starts_at: `lt.${filters.end}`,
    status: filters.status,
  });

  const response = await fetch(
    `${config.url}/rest/v1/bookings?${params.toString()}`,
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
  return Array.isArray(rows) ? (rows as BookingRow[]) : null;
}

async function requestPaidBookingIds(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  bookingIds: string[],
) {
  if (bookingIds.length === 0) return new Set<string>();

  const params = new URLSearchParams({
    booking_id: `in.(${bookingIds.join(",")})`,
    financial_status: "eq.paid",
    select: "booking_id",
  });
  const response = await fetch(
    `${config.url}/rest/v1/session_payments?${params.toString()}`,
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
  if (!Array.isArray(rows)) return null;
  return new Set(
    (rows as PaidSessionPaymentRow[]).flatMap((payment) =>
      typeof payment.booking_id === "string" ? [payment.booking_id] : [],
    ),
  );
}

function mapScheduleRow(row: BookingRow): PatientScheduleInterval | null {
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
