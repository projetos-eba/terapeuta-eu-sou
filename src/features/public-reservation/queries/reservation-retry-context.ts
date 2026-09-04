import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

export type ReservationRetrySnapshot = {
  bookingId: string;
  bookingStatus: string;
  durationMinutes: number;
  financialStatus: string;
  priceCents: number;
  serviceId: string;
  serviceLabel: string;
  startsAt: string;
  therapist: {
    avatarUrl: string | null;
    headline: string;
    isVerified: boolean;
    name: string;
    slug: string;
  };
  timezone: string;
};

export async function getReservationRetrySnapshot(input: {
  accessToken: string;
  bookingId: string;
}): Promise<ReservationRetrySnapshot | null> {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const response = await fetch(
    `${config.url}/rest/v1/rpc/get_patient_reservation_retry_context_v1`,
    {
      body: JSON.stringify({ p_booking_id: input.bookingId }),
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (!response.ok) return null;
  const value = (await response.json()) as ReservationRetrySnapshot | null;
  if (
    !value ||
    value.bookingId !== input.bookingId ||
    value.bookingStatus !== "cancelled_by_payment" ||
    !["failed", "canceled"].includes(value.financialStatus)
  ) {
    return null;
  }
  return value;
}
