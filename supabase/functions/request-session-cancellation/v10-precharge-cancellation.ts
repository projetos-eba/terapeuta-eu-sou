import type { SupabaseRestClient } from "../_shared/auth/supabase-rest.ts";

type CancellationClient = Pick<SupabaseRestClient, "rpc">;

export async function cancelV10BeforeCharge(
  client: CancellationClient,
  input: {
    bookingId: string;
    patientUserId: string;
    reason: string;
    requestId: string;
  },
) {
  return await client.rpc<{ applied: boolean; canceled: boolean }>(
    "cancel_uncharged_session_v10",
    {
      p_booking_id: input.bookingId,
      p_patient_user_id: input.patientUserId,
      p_request_id: input.requestId,
      p_reason: input.reason,
    },
  );
}
