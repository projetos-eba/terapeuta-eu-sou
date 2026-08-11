import { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";

type PaymentsDataClient = Pick<SupabaseRestClient, "get" | "rpc">;

type VideoSessionSyncResult =
  | { created: true }
  | { created: false; reason: "payment_not_found" | "video_session_exists" };

export async function ensureVideoSessionForPaidSessionPayment(
  client: PaymentsDataClient,
  input: {
    sessionPaymentId: string;
    source: string;
    zoomEnvironment: "development" | "production";
  },
): Promise<VideoSessionSyncResult> {
  const [payment] = await client.get<Array<{ booking_id: string }>>(
    `/rest/v1/session_payments?select=booking_id&id=eq.${
      encodeURIComponent(
        input.sessionPaymentId,
      )
    }&limit=1`,
  );

  if (!payment?.booking_id) {
    return { created: false, reason: "payment_not_found" };
  }

  const [videoSession] = await client.get<Array<{ id: string }>>(
    `/rest/v1/video_sessions?select=id&booking_id=eq.${
      encodeURIComponent(
        payment.booking_id,
      )
    }&limit=1`,
  );

  if (videoSession?.id) {
    return { created: false, reason: "video_session_exists" };
  }

  await client.rpc("ensure_video_session_for_paid_booking_v1", {
    p_booking_id: payment.booking_id,
    p_environment: input.zoomEnvironment,
    p_source: input.source,
  });

  return { created: true };
}
