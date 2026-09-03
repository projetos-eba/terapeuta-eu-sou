import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("booking") ?? "";
  const checkoutSessionId = url.searchParams.get("session_id");
  if (
    !UUID.test(bookingId) ||
    (checkoutSessionId && !checkoutSessionId.startsWith("cs_"))
  ) {
    return NextResponse.json({ status: "failed" }, { status: 422 });
  }

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_patient_access_token")?.value;
  if (!config || !accessToken) {
    return NextResponse.json({ status: "failed" }, { status: 401 });
  }

  const response = await fetch(
    `${config.url}/rest/v1/rpc/get_patient_reservation_attempt_status_v1`,
    {
      body: JSON.stringify({
        p_booking_id: bookingId,
        p_stripe_checkout_session_id: checkoutSessionId,
      }),
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (!response.ok) {
    return NextResponse.json({ status: "failed" }, { status: response.status });
  }
  const result = await response.json();
  if (result?.bookingId !== bookingId) {
    return NextResponse.json({ status: "unavailable" }, { status: 404 });
  }
  return NextResponse.json(result);
}
